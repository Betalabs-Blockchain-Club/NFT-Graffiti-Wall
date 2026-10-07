import type { VerificationResult } from "../lib/verify";
interface VerifyBadgeProps { result: VerificationResult; }
const shortHash = (hash: string) => `${hash.slice(0, 12)}…${hash.slice(-10)}`;
export function VerifyBadge({ result }: VerifyBadgeProps) {
  const date = new Date(Number(result.timestamp) * 1_000).toLocaleString();
  return <section className={`verification-card ${result.verified ? "verified" : "failed"}`} aria-live="polite">
    <p className="badge">{result.verified ? "✓ VERIFIED" : "✕ FAILED"}</p>
    <h2>{result.verified ? "This artwork matches its on-chain fingerprint." : "This artwork does not match its on-chain fingerprint."}</h2>
    <dl>
      <div><dt>Token</dt><dd>#{result.tokenId.toString()}</dd></div><div><dt>Artist</dt><dd>{result.nickname || "Anonymous"}</dd></div>
      <div><dt>Minted</dt><dd>{date}</dd></div><div><dt>Image CID</dt><dd className="mono">{result.ipfsCID}</dd></div>
      <div><dt>On-chain hash</dt><dd className="mono" title={result.onChainHash}>{shortHash(result.onChainHash)}</dd></div>
      <div><dt>Recomputed hash</dt><dd className="mono" title={result.recomputedHash}>{shortHash(result.recomputedHash)}</dd></div>
    </dl>
    {result.explorerUrl && <a href={result.explorerUrl} target="_blank" rel="noreferrer">View contract in explorer ↗</a>}
  </section>;
}
