import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ArtworkExport } from "../components/DrawingCanvas/DrawingCanvas";
import { MintProgress } from "../components/MintProgress/MintProgress";
import { useMintJob } from "../hooks/useMintJob";

type ProgressLocationState = { artwork?: ArtworkExport; nickname?: string };

export function Progress() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ProgressLocationState | null;
  const artwork = state?.artwork;
  const nickname = state?.nickname;
  const controller = useMintJob(artwork, nickname);
  const { job } = controller;

  useEffect(() => {
    if (artwork && nickname) void controller.submit();
  }, [artwork, controller.submit, nickname]);

  if (!artwork || !nickname) {
    return (
      <main className="stub-screen">
        <div className="stub-panel">
          <div className="stub-kicker">Mint session not found</div>
          <h1>Let&apos;s make a new mark.</h1>
          <p>Your drawing or nickname was not carried into this step.</p>
          <button className="primary-action" onClick={() => navigate("/draw")}>Start again <ArrowRight size={20} /></button>
        </div>
      </main>
    );
  }

  return (
    <main className="progress-screen">
      <MintProgress
        nickname={nickname}
        job={job}
        isConnected={controller.isConnected}
        onContinue={() => navigate("/certificate", { state: { artwork, nickname, job } })}
      />
    </main>
  );
}
