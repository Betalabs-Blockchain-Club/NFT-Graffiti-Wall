import { useEffect } from "react";
import { ArrowRight, Check, LoaderCircle, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ArtworkExport } from "../components/DrawingCanvas/DrawingCanvas";
import { useMintJob } from "../hooks/useMintJob";

type ProgressLocationState = { artwork?: ArtworkExport; nickname?: string };

const stages = ["hashing", "uploading", "minting", "confirmed"] as const;

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

  const activeIndex = job.stage ? stages.indexOf(job.stage as typeof stages[number]) : -1;
  const failed = job.stage === "failed" || Boolean(job.error);

  return (
    <main className="progress-screen">
      <div className="progress-panel">
        <div className="stub-kicker">03 / minting your proof</div>
        <h1>{failed ? "One more try." : "Your mark is moving."}</h1>
        <p className="progress-subtitle">{failed ? job.error : `Creating a blockchain certificate for ${nickname}.`}</p>
        <div className="progress-stages">
          {stages.map((stage, index) => (
            <div className={`progress-stage ${index <= activeIndex && !failed ? "is-active" : ""} ${job.stage === stage ? "is-current" : ""}`} key={stage}>
              <span>{index < activeIndex && !failed ? <Check size={18} /> : index === activeIndex && !failed ? <LoaderCircle className="spin" size={18} /> : index + 1}</span>
              <strong>{stage}</strong>
            </div>
          ))}
        </div>
        <div className="progress-details">
          <span>SHA-256</span><code>{job.hash.slice(0, 16)}...</code>
          {job.imageCID && <><span>Image CID</span><code>{job.imageCID}</code></>}
          {job.txHash && <><span>Transaction</span><code>{job.txHash.slice(0, 18)}...</code></>}
          {job.retryInfo && <><span>Queue</span><code>{job.retryInfo}</code></>}
        </div>
        {failed ? (
          <button className="primary-action" onClick={() => void controller.retry()} disabled={controller.isSubmitting}><RotateCcw size={20} /> Retry mint</button>
        ) : job.stage === "confirmed" ? (
          <button className="primary-action" onClick={() => navigate("/certificate", { state: { artwork, nickname, job } })}>View certificate <ArrowRight size={20} /></button>
        ) : (
          <div className="connection-note">{controller.isConnected ? "Live status connected" : "Polling for status..."}</div>
        )}
      </div>
    </main>
  );
}