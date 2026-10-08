import { useCallback, useEffect, useState } from "react";
import { Queue } from "./pages/Queue";

const IDLE_LIMIT_MS = 5 * 60 * 1000;

export default function App() {
  const [token, setToken] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [draft, setDraft] = useState("");

  const lock = useCallback((message = "") => {
    setToken("");
    setDraft("");
    setAuthMessage(message);
  }, []);

  const rejectToken = useCallback((message: string) => lock(`${message} Enter the current admin token to continue.`), [lock]);

  useEffect(() => {
    if (!token) return;
    let timeout = window.setTimeout(() => lock("Session locked after five minutes of inactivity."), IDLE_LIMIT_MS);
    const resetIdleTimer = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => lock("Session locked after five minutes of inactivity."), IDLE_LIMIT_MS);
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "wheel"];
    for (const event of events) window.addEventListener(event, resetIdleTimer, { passive: true });
    return () => {
      window.clearTimeout(timeout);
      for (const event of events) window.removeEventListener(event, resetIdleTimer);
    };
  }, [token, lock]);

  if (token) return <Queue token={token} onLock={() => lock()} onUnauthorized={rejectToken} />;

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">GW</div>
        <p className="eyebrow">STAFF ACCESS</p>
        <h1>Moderation desk</h1>
        <p className="muted">Enter the admin bearer token to review the wall queue.</p>
        {authMessage && <p className="notice notice-error" role="alert">{authMessage}</p>}
        <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { setAuthMessage(""); setToken(draft.trim()); } }}>
          <label htmlFor="admin-token">Admin token</label>
          <input id="admin-token" type="password" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} required autoFocus />
          <button className="button button-primary button-wide" type="submit">Unlock moderation</button>
        </form>
        <p className="privacy-note">Your token stays in this tab’s memory and is cleared when you lock or close it.</p>
      </section>
    </main>
  );
}
