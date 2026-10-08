import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { VerifyBadge } from "../components/VerifyBadge";
import { VerifiedDownloads } from "../components/VerifiedDownloads";
import { TamperCanvas } from "../components/TamperCanvas";
import { type VerificationResult, type VerificationStage, VerificationError, parseGateways, verifyToken } from "../lib/verify";
const stageMessages: Record<VerificationStage, string> = { chain: "Reading the original fingerprint from the blockchain…", image: "Loading the original artwork from IPFS…", hash: "Recomputing the artwork fingerprint in your browser…" };
function runtimeConfig() {
  const configuredGateways = parseGateways(import.meta.env.VITE_IPFS_GATEWAYS);
  const legacyGateway = parseGateways(import.meta.env.VITE_IPFS_GATEWAY);
  return { rpcUrl: import.meta.env.VITE_RPC_URL ?? "", contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS ?? "", ipfsGateways: configuredGateways.length ? configuredGateways : legacyGateway, chainId: import.meta.env.VITE_CHAIN_ID ?? "80002", explorerUrl: import.meta.env.VITE_EXPLORER_URL ?? "https://amoy.polygonscan.com/" };
}
export function VerifyToken() {
  const { tokenId = "" } = useParams(); const [stage, setStage] = useState<VerificationStage>("chain");
  const [result, setResult] = useState<VerificationResult>(); const [error, setError] = useState<VerificationError>(); const config = useMemo(runtimeConfig, []);
  useEffect(() => { let active = true; setStage("chain"); setResult(undefined); setError(undefined);
    verifyToken(tokenId, config, (nextStage) => active && setStage(nextStage)).then((nextResult) => active && setResult(nextResult)).catch((cause: unknown) => {
      if (active) setError(cause instanceof VerificationError ? cause : new VerificationError("chain", "Verification could not be completed."));
    }); return () => { active = false; };
  }, [config, tokenId]);
  if (error) return <main className="page"><section className="error-card"><p className="eyebrow">{error.kind === "not-found" ? "NOT FOUND" : "VERIFICATION UNAVAILABLE"}</p><h1>{error.message}</h1><p>Check the QR code or try again when the chain and IPFS gateway are reachable.</p></section></main>;
  if (!result) return <main className="page"><section className="loading-card"><span className="spinner" aria-hidden="true" /><h1>Checking token #{tokenId || "…"}</h1><p>{stageMessages[stage]}</p></section></main>;
  return <main className="page"><div className="artwork"><img src={result.imageUrl} alt={`Artwork by ${result.nickname || "anonymous artist"}`} /></div><VerifyBadge result={result} />{result.verified && <><VerifiedDownloads result={result} /><TamperCanvas imageUrl={result.imageUrl} imageBytes={result.imageBytes} originalHash={result.onChainHash} /></>}</main>;
}
