import type { HealthSummary } from "../lib/api";

interface QueueHealthProps {
  health: HealthSummary | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

export function QueueHealth({ health, loading, error, onRefresh }: QueueHealthProps) {
  const balance = health?.balanceEth;
  const hasBalance = typeof balance === "number";
  const lowBalance = hasBalance && balance < 0.01;

  return (
    <section className="health-section" aria-labelledby="health-title">
      <div className="section-heading">
        <div><p className="eyebrow">LIVE SYSTEM STATUS</p><h2 id="health-title">Wall health</h2></div>
        <button className="button button-outline" onClick={onRefresh} disabled={loading}>↻ <span>Refresh</span></button>
      </div>
      {lowBalance && <div className="balance-alert" role="alert"><span className="alert-symbol">!</span><div><strong>Low wallet balance</strong><p>Minting may fail until the wallet is funded.</p></div><b>{balance.toFixed(4)} POL</b></div>}
      {error && <p className="notice notice-error" role="alert">Health check failed: {error}</p>}
      <div className="health-grid">
        <HealthCard title="Chain RPC" state={health ? (health.chain ? "online" : "offline") : "unknown"} label={health ? (health.chain ? "Connected" : "Unavailable") : "—"} />
        <HealthCard title="IPFS storage" state={health ? (health.ipfs ? "online" : "offline") : "unknown"} label={health ? (health.ipfs ? "Connected" : "Unavailable") : "—"} />
        <HealthCard title="Queue depth" state="neutral" label={health && health.queueDepth !== false ? String(health.queueDepth) : "Unavailable"} />
        <HealthCard title="Wallet balance" state={lowBalance ? "offline" : hasBalance ? "online" : "unknown"} label={hasBalance ? `${balance.toFixed(4)} POL` : "Unavailable"} />
      </div>
      <p className="health-updated">{loading ? "Refreshing checks…" : health ? `Overall status: ${health.ok ? "healthy" : "degraded"}` : "Waiting for the first health check."}</p>
    </section>
  );
}

function HealthCard({ title, state, label }: { title: string; state: "online" | "offline" | "unknown" | "neutral"; label: string }) {
  return <article className="health-card"><span className={`health-indicator indicator-${state}`} aria-hidden="true" /> <div><p>{title}</p><strong>{label}</strong></div></article>;
}
