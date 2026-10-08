import { useCallback, useState } from "react";
import { Queue } from "./pages/Queue";
import { Dashboard } from "./pages/Dashboard";
import { Gallery } from "./pages/Gallery";
import type { AdminPage } from "./components/AdminHeader";

export default function App() {
  const [token, setToken] = useState(() => {
    try { return window.sessionStorage.getItem("admin-token") ?? ""; }
    catch { return ""; }
  });
  const [authMessage, setAuthMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState<AdminPage>("queue");

  const lock = useCallback((message = "") => {
    try { window.sessionStorage.removeItem("admin-token"); } catch { /* Storage may be unavailable. */ }
    setToken("");
    setDraft("");
    setAuthMessage(message);
  }, []);

  const rejectToken = useCallback((message: string) => lock(`${message} Enter the current admin token to continue.`), [lock]);

  if (token) {
    const lockSession = () => { lock(); setPage("queue"); };
    if (page === "dashboard") return <Dashboard token={token} onLock={lockSession} onUnauthorized={rejectToken} onNavigate={setPage} />;
    if (page === "gallery") return <Gallery token={token} onLock={lockSession} onUnauthorized={rejectToken} onNavigate={setPage} />;
    return <Queue token={token} onLock={lockSession} onUnauthorized={rejectToken} onNavigate={setPage} />;
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">GW</div>
        <p className="eyebrow">STAFF ACCESS</p>
        <h1>Moderation desk</h1>
        <p className="muted">Enter the admin bearer token to review the wall queue.</p>
        {authMessage && <p className="notice notice-error" role="alert">{authMessage}</p>}
        <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { const value = draft.trim(); try { window.sessionStorage.setItem("admin-token", value); } catch { /* Keep the active session in memory if storage is unavailable. */ } setAuthMessage(""); setToken(value); } }}>
          <label htmlFor="admin-token">Admin token</label>
          <input id="admin-token" type="password" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} required autoFocus />
          <button className="button button-primary button-wide" type="submit">Unlock moderation</button>
        </form>
        <p className="privacy-note">Your session stays active across reloads in this tab. Lock the session or close the tab to clear it.</p>
      </section>
    </main>
  );
}
