import { useCallback, useEffect, useState } from "react";
import { ApiError, artworkImageUrl, listQueue, moderate } from "../lib/api";
import { AdminHeader, type AdminPage } from "../components/AdminHeader";
import type { GalleryItem, QueueStatus } from "../types";

const tabs: Array<{ id: QueueStatus; label: string }> = [
  { id: "pending", label: "Pending" },
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await listQueue(status, token)); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load the moderation queue.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setError(message);
    } finally { setLoading(false); }
  }, [status, token, onUnauthorized]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function act(item: GalleryItem, action: "approve" | "hide") {
    const previousItems = items;
    setBusyId(item.id);
    setNotice("");
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      const updated = await moderate(item.id, action, token);
      setNotice(action === "hide" ? `${item.nickname} was hidden.` : `${item.nickname} was approved and restored.`);
      if (updated.status === status) setItems((current) => [updated, ...current]);
    } catch (cause) {
      setItems(previousItems);
      const message = cause instanceof Error ? cause.message : "The moderation action failed.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setError(message);
    } finally { setBusyId(""); }
  }

  return (
    <main className="admin-shell">
      <AdminHeader page="queue" onNavigate={onNavigate} onLock={onLock} />

      <section className="queue-heading" id="top">
        <div><p className="eyebrow">WALL CONTROL</p><h1>Artwork queue</h1><p className="muted">Review each submission before it appears on the public wall.</p></div>
        <button className="button button-outline" onClick={() => void refresh()} disabled={loading}>↻ <span>Refresh</span></button>
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
                {artworkImageUrl(item) ? <img src={artworkImageUrl(item)} alt={`Artwork submitted by ${item.nickname}`} loading="lazy" /> : <span className="preview-fallback">Artwork preview unavailable</span>}
                <span className={`status-pill status-${item.status}`}>{item.status}</span>
              </div>
              <div className="art-details">
                <div className="creator-row"><span className="nickname">{item.nickname}</span>{item.tokenId != null && <span className="token-id">#{item.tokenId}</span>}</div>
                <p className="art-meta">Submitted {formatDate(item.createdAt)}</p>
                <p className="art-cid" title={item.imageCID}>CID · {item.imageCID}</p>
                <div className="card-actions">
                  <button className="button button-primary" onClick={() => void act(item, "approve")} disabled={Boolean(busyId)}>{status === "hidden" ? "Restore" : "Approve"}</button>
                  {status !== "hidden" && <button className="button button-danger" onClick={() => void act(item, "hide")} disabled={Boolean(busyId)}>Hide</button>}
                </div>
              </div>
            </article>)}
          </section>}
      <footer className="queue-footer">Moderation decisions are recorded by the Graffiti Wall backend.</footer>
    </main>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "an unknown time" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
