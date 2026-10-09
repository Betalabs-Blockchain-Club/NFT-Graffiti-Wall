import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { blobToBytes, exportPNG } from "@graffiti/shared/canvas";
import { sha256Bytes } from "@graffiti/shared/hashing";
import { Eraser, Minus, Paintbrush, Plus, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { loadDrawingDraft, saveDrawingDraft } from "../../hooks/useKioskSession";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 760;
const MAX_PNG_BYTES = 500 * 1024;
const STARTING_SECONDS = 60;

export type ArtworkExport = {
  blob: Blob;
  bytes: Uint8Array;
  clientHash: string;
};

export type DrawingCanvasHandle = {
  exportArtwork(): Promise<ArtworkExport>;
};

type Point = { x: number; y: number };

interface DrawingCanvasProps {
  onTimeUp?: () => void | Promise<void>;
}

function snapshot(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

function restore(canvas: HTMLCanvasElement, dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas context is unavailable"));
        return;
      }
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      context.drawImage(image, 0, 0);
      resolve();
    };
    image.onerror = () => reject(new Error("Could not restore drawing history"));
    image.src = dataUrl;
  });
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(function DrawingCanvas({ onTimeUp }, ref) {
  const [draft] = useState(loadDrawingDraft);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const draftImageRef = useRef(draft?.dataUrl);
  const drawingRef = useRef(false);
  const previousPointRef = useRef<Point | null>(null);
  const [color, setColor] = useState(draft?.color ?? "#101313");
  const [brushSize, setBrushSize] = useState(draft?.brushSize ?? 18);
  const [tool, setTool] = useState<"brush" | "eraser">(draft?.tool ?? "brush");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [seconds, setSeconds] = useState(draft?.seconds ?? STARTING_SECONDS);
  const [hasStarted, setHasStarted] = useState(draft?.hasStarted ?? false);
  const timeUpHandledRef = useRef(draft?.hasStarted === true && draft.seconds === 0);

  const persistDraft = (dataUrl = draftImageRef.current, saveImage = true) => {
    saveDrawingDraft({ dataUrl, seconds, hasStarted, color, brushSize, tool }, saveImage);
  };

  const recordHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    const nextSnapshot = snapshot(canvas);
    next.push(nextSnapshot);
    if (next.length > 20) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    draftImageRef.current = nextSnapshot;
    persistDraft(nextSnapshot);
    setHistoryIndex(historyIndexRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const initialize = async () => {
      if (draft?.dataUrl) {
        try { await restore(canvas, draft.dataUrl); } catch { /* Start with a blank canvas if the saved image is invalid. */ }
      }
      const current = snapshot(canvas);
      draftImageRef.current = current;
      historyRef.current = [current];
      historyIndexRef.current = 0;
      setHistoryIndex(0);
      persistDraft(current);
    };
    void initialize();
  }, []);

  useEffect(() => {
    persistDraft(draftImageRef.current, false);
  }, [seconds, hasStarted, color, brushSize, tool]);

  useEffect(() => {
    if (!hasStarted || seconds === 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [hasStarted, seconds]);

  useEffect(() => {
    if (!hasStarted || seconds !== 0 || timeUpHandledRef.current) return;
    timeUpHandledRef.current = true;
    void onTimeUp?.();
  }, [hasStarted, seconds, onTimeUp]);

  useImperativeHandle(ref, () => ({
    async exportArtwork() {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Drawing canvas is unavailable");
      const blob = await exportPNG(canvas, { maxBytes: MAX_PNG_BYTES });
      const bytes = await blobToBytes(blob);
      const clientHash = await sha256Bytes(bytes);
      return { blob, bytes, clientHash };
    }
  }), []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    previousPointRef.current = pointFromEvent(event);
    setHasStarted(true);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !previousPointRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const currentPoint = pointFromEvent(event);
    context.save();
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(previousPointRef.current.x, previousPointRef.current.y);
    context.lineTo(currentPoint.x, currentPoint.y);
    context.stroke();
    context.restore();
    previousPointRef.current = currentPoint;
  };

  const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    previousPointRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    recordHistory();
  };

  const changeHistory = async (direction: -1 | 1) => {
    const nextIndex = historyIndexRef.current + direction;
    const nextSnapshot = historyRef.current[nextIndex];
    const canvas = canvasRef.current;
    if (!canvas || !nextSnapshot) return;
    await restore(canvas, nextSnapshot);
    historyIndexRef.current = nextIndex;
    draftImageRef.current = nextSnapshot;
    persistDraft(nextSnapshot);
    setHistoryIndex(nextIndex);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    recordHistory();
  };

  return (
    <section className="drawing-tool" aria-label="Drawing canvas">
      <div className="drawing-toolbar">
        <div className="tool-group">
          <button className={`tool-button ${tool === "brush" ? "is-selected" : ""}`} onClick={() => setTool("brush")} aria-label="Brush" title="Brush">
            <Paintbrush size={22} />
          </button>
          <button className={`tool-button ${tool === "eraser" ? "is-selected" : ""}`} onClick={() => setTool("eraser")} aria-label="Eraser" title="Eraser">
            <Eraser size={22} />
          </button>
          <label className="color-picker" title="Choose brush color">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Brush color" />
          </label>
        </div>
        <div className="size-control">
          <Minus size={17} />
          <input type="range" min="4" max="64" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} aria-label="Brush size" />
          <Plus size={17} />
          <span>{brushSize}px</span>
        </div>
        <div className="tool-group tool-group-right">
          <button className="tool-button" onClick={() => void changeHistory(-1)} disabled={historyIndex <= 0} aria-label="Undo" title="Undo"><Undo2 size={22} /></button>
          <button className="tool-button" onClick={() => void changeHistory(1)} disabled={historyIndex >= historyRef.current.length - 1} aria-label="Redo" title="Redo"><Redo2 size={22} /></button>
          <button className="tool-button" onClick={clear} aria-label="Clear canvas" title="Clear canvas"><RotateCcw size={22} /></button>
        </div>
      </div>
      <div className="canvas-frame">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          aria-label="Draw your graffiti here"
        />
        <div className="canvas-hint">{hasStarted ? "Keep going. Make it yours." : "Touch or drag to start drawing"}</div>
      </div>
      <div className="drawing-footer">
        <div className={`timer-badge ${seconds <= 10 ? "is-warning" : ""}`}><TimerIcon /> 00:{String(seconds).padStart(2, "0")}</div>
        <span className="exact-bytes-note">PNG export capped at 500 KB</span>
      </div>
    </section>
  );
});

function TimerIcon() {
  return <span className="timer-icon" aria-hidden="true" />;
}
