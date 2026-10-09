import { useCallback, useEffect, useState } from "react";
import { AdminHeader, type AdminPage } from "../components/AdminHeader";
import { ApiError, archiveArtwork, listQueue } from "../lib/api";
import { ArtworkPreview } from "../components/ArtworkPreview";
import { ArtworkCertificate } from "../components/ArtworkCertificate";
import type { GalleryItem } from "../types";

interface GalleryProps {
  token: string;
  onLock: () => void;
  onUnauthorized: (message: string) => void;
  onNavigate: (page: AdminPage) => void;
}

export function Gallery({ token, onLock, onUnauthorized, onNavigate }: GalleryProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [certificateItem, setCertificateItem] = useState<GalleryItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await listQueue("approved", token)); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load the public gallery.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setError(message);
    } finally { setLoading(false); }
  }, [token, onUnauthorized]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function remove(item: GalleryItem) {
    if (!window.confirm(`Permanently remove “${item.nickname}” from the available gallery and admin queue? This cannot be restored from the admin.`)) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      await archiveArtwork(item.id, token);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(`“${item.nickname}” was permanently removed from the available gallery and queue.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not remove artwork from the gallery.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setError(message);
    } finally { setBusyId(""); }
  }

  return (
    <main className="admin-shell">
      <AdminHeader page="gallery" onNavigate={onNavigate} onLock={onLock} />
      <section className="queue-heading" id="top">
        <div><p className="eyebrow">PUBLIC WALL</p><h1>Gallery</h1><p className="muted">Review published artwork and permanently remove individual items from the available gallery and queue.</p></div>
        <button className="button button-outline" onClick={() => void refresh()} disabled={loading}>↻ <span>Refresh</span></button>
      </section>
      {notice && <p className="notice notice-success" role="status">✓ {notice}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {loading ? <section className="empty-state"><span className="loader" aria-hidden="true" /><p>Loading published artwork…</p></section>
        : items.length === 0 ? <section className="empty-state"><span className="empty-icon" aria-hidden="true">✦</span><h2>Gallery is empty</h2><p>There are no published items to manage.</p></section>
          : <section className="art-grid" aria-label="Published gallery artwork">
            {items.map((item) => <article className="art-card" key={item.id}>
              <div className="art-preview">
                <button className="card-art-open" type="button" onClick={() => setCertificateItem(item)} aria-label={`View certificate for ${item.nickname}`}>
                  <ArtworkPreview item={item} />
                </button>
                <span className="status-pill status-approved">Published</span>
              </div>
              <div className="art-details">
                <div className="creator-row">
                  <span className="nickname" style={{ cursor: "pointer" }} onClick={() => setCertificateItem(item)}>{item.nickname}</span>
                  {item.tokenId != null && (
                    <button type="button" className="token-id" onClick={() => setCertificateItem(item)} aria-label={`View ticket for token #${item.tokenId}`}>
                      #{item.tokenId}
                    </button>
                  )}
                </div>
                <p className="art-meta">Published {formatDate(item.createdAt)}</p>
                <p className="art-cid" title={item.imageCID}>CID · {item.imageCID}</p>
                <div className="card-actions">
                  <button className="button button-outline" type="button" onClick={() => setCertificateItem(item)}>View ticket</button>
                  <button className="button button-danger" type="button" onClick={() => void remove(item)} disabled={Boolean(busyId)}>{busyId === item.id ? "Removing…" : "Permanently remove"}</button>
                </div>
              </div>
            </article>)}
          </section>}
      <footer className="queue-footer">Permanently removed artwork is archived and no longer appears in the public gallery or admin queue.</footer>
      {certificateItem && (
        <ArtworkCertificate
          item={certificateItem}
          token={token}
          onClose={() => setCertificateItem(null)}
          onUnauthorized={onUnauthorized}
        />
      )}
    </main>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "an unknown time" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
