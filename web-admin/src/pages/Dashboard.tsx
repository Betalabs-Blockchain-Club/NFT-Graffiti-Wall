import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminHeader, type AdminPage } from "../components/AdminHeader";
import { NetworkSwitch } from "../components/NetworkSwitch";
import { QueueHealth } from "../components/QueueHealth";
import { ApiError, archiveWall, getAdminConfig, getHealth, updateAdminConfig, type AdminConfig, type HealthSummary } from "../lib/api";

interface DashboardProps {
  token: string;
  onLock: () => void;
  onUnauthorized: (message: string) => void;
  onNavigate: (page: AdminPage) => void;
}

export function Dashboard({ token, onLock, onUnauthorized, onNavigate }: DashboardProps) {
  const confirmationPhrase = `ARCHIVE ${new Date().toISOString().slice(0, 10)}`;
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState("");
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [saving, setSaving] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError("");
    try { setHealth(await getHealth(token)); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "The health endpoint could not be reached.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setHealthError(message);
    } finally { setHealthLoading(false); }
  }, [token, onUnauthorized]);

  useEffect(() => {
    let active = true;
    getAdminConfig(token).then((current) => { if (active) setConfig(current); }).catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : "Could not load server settings.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else if (active) setConfigError(message);
    });
    void refreshHealth();
    const interval = window.setInterval(() => void refreshHealth(), 20_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token, onUnauthorized, refreshHealth]);

  async function saveConfig(patch: Partial<AdminConfig>) {
    setSaving(true);
    setConfigError("");
    setNotice("");
    try {
      const saved = await updateAdminConfig(patch, token);
      setConfig(saved);
      setNotice("Server settings updated.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save server settings.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setConfigError(message);
    } finally { setSaving(false); }
  }

  async function resetWall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typedConfirmation !== confirmationPhrase) {
      setResetError(`Type exactly ${confirmationPhrase} to continue.`);
      return;
    }
    setResetBusy(true);
    setResetError("");
    setNotice("");
    try {
      const result = await archiveWall(typedConfirmation, token);
      setTypedConfirmation("");
      setNotice(`Archive complete: ${result.artworkCount} artworks and ${result.voteCount} votes archived.`);
      void refreshHealth();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The archive request failed.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else setResetError(message);
    } finally { setResetBusy(false); }
  }

  return (
    <main className="admin-shell">
      <AdminHeader page="dashboard" onNavigate={onNavigate} onLock={onLock} />
      <section className="queue-heading dashboard-heading" id="top">
        <div><p className="eyebrow">OPERATIONS</p><h1>Wall dashboard</h1><p className="muted">Live infrastructure health and server controls.</p></div>
      </section>

      <QueueHealth health={health} loading={healthLoading} error={healthError} onRefresh={() => void refreshHealth()} />
      {notice && <p className="notice notice-success" role="status">✓ {notice}</p>}
      {configError && <p className="notice notice-error" role="alert">Settings update failed: {configError}</p>}

      <div className="dashboard-grid">
        <NetworkSwitch config={config} saving={saving} onChange={(patch) => void saveConfig(patch)} />
        <section className="settings-card reset-card" aria-labelledby="reset-title">
          <p className="eyebrow eyebrow-danger">DANGER ZONE</p><h2 id="reset-title">Archive today’s wall</h2>
          <p className="muted">Archives all active artwork and votes. This cannot be undone from the dashboard.</p>
          <form onSubmit={(event) => void resetWall(event)}>
            <label htmlFor="archive-confirm">Type <code>{confirmationPhrase}</code> to confirm</label>
            <input id="archive-confirm" autoComplete="off" value={typedConfirmation} onChange={(event) => { setTypedConfirmation(event.target.value); setResetError(""); }} placeholder={confirmationPhrase} />
            {resetError && <p className="reset-error" role="alert">{resetError}</p>}
            <button className="button button-danger reset-button" type="submit" disabled={resetBusy || typedConfirmation !== confirmationPhrase}>{resetBusy ? "Archiving…" : "Archive wall"}</button>
          </form>
        </section>
      </div>
      <footer className="queue-footer">Health updates every 20 seconds. Configuration shown here is returned by the backend.</footer>
    </main>
  );
}
