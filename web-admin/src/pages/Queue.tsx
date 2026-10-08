import { useCallback, useEffect, useState } from "react";
import { ApiError, clearMintRequests, getArtworkJob, hideArtwork, listQueue, mintArtwork, retryArtworkIpfs, restoreArtwork, type AdminJob } from "../lib/api";
import { AdminHeader, type AdminPage } from "../components/AdminHeader";
import { ArtworkPreview } from "../components/ArtworkPreview";
import { ArtworkCertificate } from "../components/ArtworkCertificate";
import type { GalleryItem, QueueStatus } from "../types";

const tabs: Array<{ id: QueueStatus; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Published" },
  { id: "minted", label: "Minted" },
  { id: "hidden", label: "Hidden" }
];

interface QueueProps {
  token: string;
  onLock: () => void;
  onUnauthorized: (message: string) => void;
  onNavigate: (page: AdminPage) => void;
}

export function Queue({ token, onLock, onUnauthorized, onNavigate }: QueueProps) {
  const [status, setStatus] = useState<QueueStatus>("pending");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [clearingRequests, setClearingRequests] = useState(false);
  const [jobs, setJobs] = useState<Record<string, AdminJob>>({});
  const [certificateItem, setCertificateItem] = useState<GalleryItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextItems = await listQueue(status, token);
      setItems(nextItems);
      if (status === "pending") {
        const entries = await Promise.all(nextItems.map(async (item) => {
          try { return [item.id, await getArtworkJob(item.id, token)] as const; }
          catch { return [item.id, { jobId: item.id, stage: "unknown" as const, error: "Mint preparation status unavailable." }] as const; }
        }));
        setJobs(Object.fromEntries(entries));
      }
    }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load the moderation queue.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setError(message);
    } finally { setLoading(false); }
  }, [status, token, onUnauthorized]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (status !== "pending" || items.length === 0) return;
    let active = true;
    const refreshJobs = async () => {
      const entries = await Promise.all(items.map(async (item) => {
        try { return [item.id, await getArtworkJob(item.id, token)] as const; }
        catch { return null; }
      }));
      if (active) setJobs((current) => ({ ...current, ...Object.fromEntries(entries.filter((entry) => entry !== null)) }));
    };
    const interval = window.setInterval(() => void refreshJobs(), 1500);
    return () => { active = false; window.clearInterval(interval); };
  }, [items, status, token]);

  async function act(item: GalleryItem, action: "mint" | "hide" | "restore" | "retry-ipfs") {
    const previousItems = items;
    setBusyId(item.id);
    setNotice("");
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      if (action === "retry-ipfs") {
        const result = await retryArtworkIpfs(item.id, token);
        setJobs((current) => ({ ...current, [item.id]: result.job }));
        setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
        if (result.job.stage === "ready") setNotice(`IPFS pinning succeeded for ${item.nickname}. It is ready to mint.`);
        else setError(result.job.error ?? `IPFS retry failed for ${item.nickname}.`);
      } else {
        const updated = action === "hide" ? await hideArtwork(item.id, token)
          : action === "restore" ? await restoreArtwork(item.id, token) : await mintArtwork(item.id, token);
        setNotice(action === "hide" ? `${item.nickname} was hidden.` : action === "restore" ? `${item.nickname} was published.` : `${item.nickname} was minted and published.`);
        if (updated.status === status) setItems((current) => [updated, ...current]);
      }
    } catch (cause) {
      setItems(previousItems);
      const message = cause instanceof Error ? cause.message : "The moderation action failed.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setError(message);
    } finally { setBusyId(""); }
  }

  async function clearRequests() {
    if (!window.confirm("Clear all pending mint requests? Requests already minting will be kept.")) return;
    setClearingRequests(true);
    setError("");
    setNotice("");
    try {
      const result = await clearMintRequests(token);
      setItems([]);
      setJobs({});
      setNotice(`${result.artworkCount} mint request${result.artworkCount === 1 ? "" : "s"} cleared.${result.skippedMintingCount ? ` ${result.skippedMintingCount} in-progress mint${result.skippedMintingCount === 1 ? " was" : "s were"} kept.` : ""}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not clear mint requests.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setError(message);
    } finally { setClearingRequests(false); }
  }

  return (
    <main className="admin-shell">
      <AdminHeader page="queue" onNavigate={onNavigate} onLock={onLock} />

      <section className="queue-heading" id="top">
        <div><p className="eyebrow">WALL CONTROL</p><h1>Artwork queue</h1><p className="muted">Mint prepared submissions to publish them on the public wall.</p></div>
        <div className="queue-heading-actions">
          {status === "pending" && <button className="button button-danger" onClick={() => void clearRequests()} disabled={loading || clearingRequests || Boolean(busyId)}>{clearingRequests ? "Clearing…" : "Clear mint requests"}</button>}
          <button className="button button-outline" onClick={() => void refresh()} disabled={loading || clearingRequests}>↻ <span>Refresh</span></button>
        </div>
      </section>

      <nav className="queue-tabs" aria-label="Queue status">
        {tabs.map((tab) => <button key={tab.id} className={`queue-tab ${status === tab.id ? "is-active" : ""}`} aria-current={status === tab.id ? "page" : undefined} onClick={() => { setNotice(""); setStatus(tab.id); }}>
          {tab.label}{status === tab.id && !loading && <span className="tab-count">{items.length}</span>}
        </button>)}
      </nav>

      {notice && <p className="notice notice-success" role="status">✓ {notice}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {loading ? <section className="empty-state"><span className="loader" aria-hidden="true" /><p>Loading {status} artwork…</p></section>
        : items.length === 0 ? <section className="empty-state"><span className="empty-icon" aria-hidden="true">✦</span><h2>All clear</h2><p>No {status} artwork to review.</p></section>
          : <section className="art-grid" aria-label={`${status} artwork`}>
            {items.map((item) => <article className="art-card" key={item.id}>
              <div className="art-preview">
                {item.tokenId != null
                  ? <button className="card-art-open" type="button" onClick={() => setCertificateItem(item)} aria-label={`View certificate for ${item.nickname}`}><ArtworkPreview item={item} /></button>
                  : <ArtworkPreview item={item} />}
                <span className={`status-pill status-${item.status}`}>{item.status}</span>
              </div>
              <div className="art-details">
                <div className="creator-row"><span className="nickname">{item.nickname}</span>{item.tokenId != null && <span className="token-id">#{item.tokenId}</span>}</div>
                <p className="art-meta">Submitted {formatDate(item.createdAt)}</p>
                <p className="art-cid" title={item.imageCID}>CID · {item.imageCID}</p>
                {status === "pending" && <p className="art-meta" role="status">
                  {jobs[item.id]?.stage === "failed" ? `${jobs[item.id]?.imageCID ? "Mint failed" : "IPFS failed"}: ${jobs[item.id]?.error ?? "Retry the operation."}`
                    : jobs[item.id]?.stage === "ready" ? "Image and metadata are pinned. Ready to mint."
                      : `Preparing artwork: ${jobs[item.id]?.stage ?? "checking status"}…`}
                </p>}
                <div className="card-actions">
                  {status === "pending" && jobs[item.id]?.stage === "ready" && <button className="button button-primary" onClick={() => void act(item, "mint")} disabled={Boolean(busyId)}>Mint NFT</button>}
                  {status === "pending" && jobs[item.id]?.stage === "failed" && jobs[item.id]?.imageCID && <button className="button button-primary" onClick={() => void act(item, "mint")} disabled={Boolean(busyId)}>Retry mint</button>}
                  {status === "pending" && jobs[item.id]?.stage === "failed" && !jobs[item.id]?.imageCID && <button className="button button-primary" onClick={() => void act(item, "retry-ipfs")} disabled={Boolean(busyId)}>Retry IPFS</button>}
                  {status !== "hidden" && <button className="button button-danger" onClick={() => void act(item, "hide")} disabled={Boolean(busyId)}>Hide</button>}
                  {status === "hidden" && <button className="button button-primary" onClick={() => void act(item, "restore")} disabled={Boolean(busyId)}>Restore</button>}
                  {status === "minted" && <button className="button button-primary" onClick={() => void act(item, "restore")} disabled={Boolean(busyId)}>Publish</button>}
                </div>
              </div>
            </article>)}
          </section>}
      <footer className="queue-footer">Minting is recorded on chain; successful NFTs publish to the wall automatically.</footer>
      {certificateItem && <ArtworkCertificate item={certificateItem} token={token} onClose={() => setCertificateItem(null)} onUnauthorized={onUnauthorized} />}
    </main>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "an unknown time" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
