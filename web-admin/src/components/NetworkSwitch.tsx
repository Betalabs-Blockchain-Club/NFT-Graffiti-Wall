import type { AdminConfig } from "../lib/api";

interface NetworkSwitchProps {
  config: AdminConfig | null;
  saving: boolean;
  onChange: (patch: Partial<AdminConfig>) => void;
}

export function NetworkSwitch({ config, saving, onChange }: NetworkSwitchProps) {
  return (
    <section className="settings-card" aria-labelledby="network-title">
      <p className="eyebrow">WALL SETTINGS</p><h2 id="network-title">Runtime controls</h2>
      <div className={`kill-switch ${config?.KILL_SWITCH ? "kill-on" : ""}`}>
        <div><strong>Minting kill switch</strong><p>{config ? (config.KILL_SWITCH ? "New artwork submissions are paused." : "New artwork submissions are enabled.") : "Loading saved setting…"}</p></div>
        <button className={`switch ${config?.KILL_SWITCH ? "switch-on" : ""}`} role="switch" aria-checked={Boolean(config?.KILL_SWITCH)} aria-label="Pause new artwork submissions" disabled={!config || saving} onClick={() => config && onChange({ KILL_SWITCH: !config.KILL_SWITCH})}><span /></button>
      </div>
      <fieldset className="setting-group" disabled={!config || saving}>
        <legend>IPFS provider</legend>
        <div className="choice-row">
          {(["pinata", "kubo"] as const).map((provider) => <button type="button" key={provider} className={`choice-button ${config?.IPFS_PROVIDER === provider ? "choice-selected" : ""}`} aria-pressed={config?.IPFS_PROVIDER === provider} onClick={() => onChange({ IPFS_PROVIDER: provider })}>{provider === "pinata" ? "Pinata" : "Kubo"}</button>)}
        </div>
      </fieldset>
      {saving && <p className="setting-saving" role="status">Saving setting…</p>}
    </section>
  );
}
