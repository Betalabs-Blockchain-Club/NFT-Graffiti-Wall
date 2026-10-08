import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { validateNickname } from "@graffiti/shared/nickname";
import type { ArtworkExport } from "../components/DrawingCanvas/DrawingCanvas";

type NicknameLocationState = { artwork?: ArtworkExport };
function newSubmissionId() {
  return globalThis.crypto?.randomUUID?.() ?? `submission-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function validationMessage(reason: "empty" | "too_long" | "profanity") {
  if (reason === "profanity") return "Try a different nickname so everyone can enjoy the wall.";
  if (reason === "too_long") return "Keep it to 32 characters or fewer.";
  return "Add a nickname before minting your art.";
}

export function Nickname() {
  const navigate = useNavigate();
  const location = useLocation();
  const artwork = (location.state as NicknameLocationState | null)?.artwork;
  const [nickname, setNickname] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const validation = useMemo(() => validateNickname(nickname), [nickname]);
  const error = touched && !validation.ok ? validationMessage(validation.reason) : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!artwork) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(artwork.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [artwork]);

  if (!artwork) {
    return (
      <main className="stub-screen">
        <div className="stub-panel">
          <div className="stub-kicker">Drawing not found</div>
          <h1>Let&apos;s start with a blank wall.</h1>
          <p>Your drawing session expired or was opened directly. Make a new mark to continue.</p>
          <button className="primary-action" onClick={() => navigate("/draw")}>Draw again <ArrowRight size={20} /></button>
        </div>
      </main>
    );
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!validation.ok || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    navigate("/progress", { state: { artwork, nickname: validation.value, submissionId: newSubmissionId() } });
  };

  return (
    <main className="nickname-screen">
      <button className="back-button" onClick={() => navigate("/draw")}><ChevronLeft size={20} /> Back to drawing</button>
      <div className="nickname-layout">
        <div className="nickname-preview">
          {previewUrl && <img src={previewUrl} alt="Your exported graffiti" />}
          <div className="preview-stamp"><Sparkles size={16} /> exact PNG ready</div>
        </div>
        <div className="nickname-copy">
          <div className="stub-kicker">02 / sign your work</div>
          <h1>What should we<br /><span>call your tag?</span></h1>
          <p>Choose a nickname, not your real name. It will travel with your artwork and appear on its certificate.</p>
          <form onSubmit={submit} noValidate>
            <label className="nickname-label" htmlFor="nickname">Nickname</label>
            <div className={`nickname-input-wrap ${error ? "has-error" : ""}`}>
              <input
                id="nickname"
                name="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={32}
                autoComplete="off"
                autoCapitalize="words"
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "nickname-error" : "nickname-count"}
                placeholder="e.g. Neon Fox"
              />
              <span id="nickname-count">{nickname.length}/32</span>
            </div>
            {error && <p className="nickname-error" id="nickname-error" role="alert">{error}</p>}
            <button className="primary-action nickname-submit" type="submit" disabled={submitting}>
              {submitting ? "Preparing mint..." : "Mint this art"} <ArrowRight size={22} />
            </button>
          </form>
          <div className="nickname-note">No wallet needed · Testnet has no real value</div>
        </div>
      </div>
    </main>
  );
}
