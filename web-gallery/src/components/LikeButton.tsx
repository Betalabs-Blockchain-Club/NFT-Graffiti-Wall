import React, { useState } from "react";
import { Heart } from "lucide-react";

interface LikeButtonProps {
  likes: number | undefined;
  liked: boolean;
  disabled?: boolean;
  onToggle: (liked: boolean) => Promise<void>;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ likes, liked, disabled = false, onToggle }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try { await onToggle(!liked); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your like could not be saved."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-2 pt-2 border-t border-slate-800/80">
      <button type="button" onClick={(event) => void toggle(event)} disabled={busy || disabled}
        aria-pressed={liked} aria-label={liked ? `Unlike artwork, ${likes ?? 0} likes` : `Like artwork, ${likes ?? 0} likes`}
        className={`inline-flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-400 disabled:cursor-wait disabled:opacity-60 ${liked ? "bg-pink-950/50 text-pink-300" : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"}`}>
        <span className="inline-flex items-center gap-2"><Heart className={`h-4 w-4 ${liked ? "fill-current text-pink-400" : "text-pink-400"}`} />{liked ? "Unlike" : "Like"}</span>
        <span className="font-mono text-pink-200">{likes === undefined ? "…" : likes}</span>
      </button>
      {error && <p role="status" className="mt-1 text-[10px] leading-snug text-rose-300">{error}</p>}
    </div>
  );
};
