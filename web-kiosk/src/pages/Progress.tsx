import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ArtworkExport } from "../components/DrawingCanvas/DrawingCanvas";
import { MintProgress } from "../components/MintProgress/MintProgress";
import { useMintJob } from "../hooks/useMintJob";
import { loadKioskSession, saveKioskSession, useRestoredArtwork } from "../hooks/useKioskSession";

type ProgressLocationState = { artwork?: ArtworkExport; nickname?: string; submissionId?: string };

export function Progress() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ProgressLocationState | null;
  const artwork = useRestoredArtwork(state?.artwork);
  const session = loadKioskSession();
  const nickname = state?.nickname ?? session.nickname;
  const submissionId = state?.submissionId ?? session.submissionId;
  const routeJobId = new URLSearchParams(location.search).get("jobId") ?? undefined;
  const savedJobId = session.jobId ?? routeJobId;
  const restoredJob = savedJobId ? { jobId: savedJobId, hash: artwork?.clientHash ?? "", retry: 0 } : undefined;
  const controller = useMintJob(artwork, nickname, submissionId, restoredJob);
  const { job } = controller;

  useEffect(() => {
    if (artwork && nickname && !job.jobId) void controller.submit();
  }, [artwork, controller.submit, job.jobId, nickname]);

  useEffect(() => {
    if (!job.jobId || new URLSearchParams(location.search).get("jobId") === job.jobId) return;
    const params = new URLSearchParams(location.search);
    params.set("jobId", job.jobId);
    saveKioskSession({ jobId: job.jobId });
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true, state: location.state });
  }, [job.jobId, location.pathname, location.search, location.state, navigate]);

  if ((!artwork || !nickname) && !job.jobId) {
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
        nickname={nickname ?? "your artwork"}
        job={job}
        isConnected={controller.isConnected}
        canContinue={Boolean(artwork && nickname)}
        onContinue={() => {
          if (artwork && nickname) navigate("/certificate", { state: { artwork, nickname, job } });
        }}
      />
    </main>
  );
}
