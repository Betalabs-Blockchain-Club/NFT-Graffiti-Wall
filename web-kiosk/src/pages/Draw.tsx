import { useRef, useState } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DrawingCanvas, type ArtworkExport, type DrawingCanvasHandle } from "../components/DrawingCanvas/DrawingCanvas";

export function Draw() {
  const navigate = useNavigate();
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const continueToNickname = async () => {
    if (!canvasRef.current || exporting) return;
    setError(null);
    setExporting(true);
    try {
      const artwork: ArtworkExport = await canvasRef.current.exportArtwork();
      navigate("/nickname", { state: { artwork } });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export this drawing");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="draw-screen">
      <div className="draw-heading">
        <div>
          <div className="stub-kicker">01 / make your mark</div>
          <h1>Draw something<br /><span>unmistakably yours.</span></h1>
        </div>
        <button className="back-button" onClick={() => navigate("/")}><ChevronLeft size={20} /> Start over</button>
      </div>
      <DrawingCanvas ref={canvasRef} onTimeUp={() => void continueToNickname()} />
      {error && <p className="drawing-error" role="alert">{error}</p>}
      <button className="continue-drawing primary-action" onClick={() => void continueToNickname()} disabled={exporting}>
        {exporting ? "Preparing exact PNG..." : "Keep this drawing"} <ArrowRight size={22} />
      </button>
    </main>
  );
}
