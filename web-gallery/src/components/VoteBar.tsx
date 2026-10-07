import React from "react";
import { ThumbsUp } from "lucide-react";

interface VoteBarProps {
  votes?: number;
  maxVotes?: number;
}

export const VoteBar: React.FC<VoteBarProps> = ({ votes, maxVotes = 10 }) => {
  if (votes === undefined || votes === null) {
    return null;
  }

  // Calculate percentage of max votes (minimum 5% if votes > 0 for visual bar)
  const safeMax = Math.max(maxVotes, 1);
  const percentage = Math.min(Math.round((votes / safeMax) * 100), 100);

  return (
    <div className="w-full mt-2 pt-2 border-t border-slate-800/80">
      <div className="flex items-center justify-between text-xs mb-1 font-mono">
        <span className="text-slate-400 flex items-center gap-1">
          <ThumbsUp className="w-3 h-3 text-cyan-400" />
          <span>Votes</span>
        </span>
        <span className="text-cyan-300 font-bold">{votes}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(percentage, votes > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
};
