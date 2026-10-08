import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ArtworkExport } from "../components/DrawingCanvas/DrawingCanvas";
import { CertificateCard } from "../components/CertificateCard/CertificateCard";
import type { MintJobState } from "../hooks/useMintJob";

type CertificateLocationState = { artwork?: ArtworkExport; nickname?: string; job?: MintJobState };

export function Certificate() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CertificateLocationState | null;

  if (!state?.artwork || !state.nickname || !state.job?.tokenId) {
    return (
      <main className="stub-screen">
        <div className="stub-panel">
          <div className="stub-kicker">Certificate not found</div>
          <h1>Mint your mark first.</h1>
          <p>Your confirmed artwork certificate is only available after the mint finishes.</p>
          <button className="primary-action" onClick={() => navigate("/draw")}>Start again <ArrowRight size={20} /></button>
        </div>
      </main>
    );
  }

  return (
    <main className="certificate-screen">
      <CertificateCard artwork={state.artwork} nickname={state.nickname} job={state.job} />
    </main>
  );
}