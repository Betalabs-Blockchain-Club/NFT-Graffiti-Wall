export type AdminPage = "queue" | "dashboard";

interface AdminHeaderProps {
  page: AdminPage;
  onNavigate: (page: AdminPage) => void;
  onLock: () => void;
}

export function AdminHeader({ page, onNavigate, onLock }: AdminHeaderProps) {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Graffiti Wall moderation home"><span className="brand-mark">GW</span><span>Graffiti Wall <small>MODERATION</small></span></a>
      <nav className="admin-nav" aria-label="Admin sections">
        <button className={`admin-nav-link ${page === "queue" ? "is-active" : ""}`} aria-current={page === "queue" ? "page" : undefined} onClick={() => onNavigate("queue")}>Queue</button>
        <button className={`admin-nav-link ${page === "dashboard" ? "is-active" : ""}`} aria-current={page === "dashboard" ? "page" : undefined} onClick={() => onNavigate("dashboard")}>Operations</button>
      </nav>
      <div className="topbar-actions"><span className="session-label"><span className="live-dot" /> Admin session</span><button className="button button-quiet" onClick={onLock}>Lock session</button></div>
    </header>
  );
}
