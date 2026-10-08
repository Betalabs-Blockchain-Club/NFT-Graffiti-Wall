import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, Wifi, WifiOff } from "lucide-react";
import type { MintJobState } from "../../hooks/useMintJob";

const stages = ["hashing", "uploading", "ready", "minting", "confirmed"] as const;
const labels: Record<typeof stages[number], string> = {
  hashing: "Hashing",
  uploading: "Uploading",
  ready: "Ready for mint",
  minting: "Minting",
  confirmed: "Confirmed"
};

type MintProgressProps = {
  nickname: string;
  job: MintJobState;
  isConnected: boolean;
  onContinue: () => void;
};

export function MintProgress({ nickname, job, isConnected, onContinue }: MintProgressProps) {
  const failed = job.stage === "failed" || Boolean(job.error);
  const activeIndex = job.stage ? stages.indexOf(job.stage as typeof stages[number]) : -1;
  const percent = failed ? 100 : job.stage === "confirmed" ? 100 : Math.max(8, ((activeIndex + 0.5) / stages.length) * 100);

  return (
    <section className="mint-progress-card" aria-live="polite">
      <div className="mint-progress-heading">
        <div>
          <div className="stub-kicker">03 / minting your proof</div>
          <AnimatePresence mode="wait">
            <motion.h1 key={failed ? "failed" : job.stage ?? "starting"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              {failed ? "Staff help needed." : job.stage === "ready" ? "Your artwork is ready." : job.stage === "confirmed" ? "Proof complete." : "Your mark is moving."}
            </motion.h1>
          </AnimatePresence>
        </div>
        <div className={`connection-pill ${isConnected ? "is-live" : ""}`}>
          {isConnected ? <Wifi size={15} /> : <WifiOff size={15} />}
          {isConnected ? "Live status" : "Polling fallback"}
        </div>
      </div>
      <p className="progress-subtitle">{failed ? job.error : job.stage === "ready" ? "Your artwork is pinned and waiting for staff to mint it." : `Creating a blockchain certificate for ${nickname}.`}</p>
      <div className="progress-meter" aria-hidden="true"><motion.span animate={{ width: `${percent}%` }} transition={{ duration: 0.5 }} /></div>
      <div className="progress-stages">
        {stages.map((stage, index) => {
          const complete = !failed && index < activeIndex;
          const current = !failed && index === activeIndex;
          return (
            <motion.div className={`progress-stage ${complete || current ? "is-active" : ""} ${current ? "is-current" : ""}`} key={stage} animate={{ opacity: complete || current ? 1 : .55 }}>
              <span>{complete ? <Check size={18} /> : current ? <LoaderCircle className="spin" size={18} /> : index + 1}</span>
              <strong>{labels[stage]}</strong>
            </motion.div>
          );
        })}
      </div>
      <div className="progress-details">
        <span>SHA-256</span><code title={job.hash}>{job.hash ? `${job.hash.slice(0, 16)}...` : "preparing..."}</code>
        {job.imageCID && <><span>Image CID</span><code title={job.imageCID}>{job.imageCID}</code></>}
        {job.txHash && <><span>Transaction</span><code title={job.txHash}>{job.txHash.slice(0, 18)}...</code></>}
        {job.retryInfo && <><span>Queue</span><code>{job.retryInfo}</code></>}
      </div>
      {failed ? (
        <div className="connection-note">Please ask a staff member to retry this artwork from the admin queue.</div>
      ) : job.stage === "confirmed" ? (
        <button className="primary-action" onClick={onContinue}>Continue <Check size={20} /></button>
      ) : (
        <div className="connection-note">Waiting for confirmation from the mint queue...</div>
      )}
    </section>
  );
}
