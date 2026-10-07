import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Palette, TimerReset } from "lucide-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Attract } from "./pages/Attract";
import { Draw } from "./pages/Draw";
import { kioskConfig } from "./lib/config";

const screens = [
  { path: "/draw", label: "Draw", icon: Palette },
  { path: "/nickname", label: "Nickname", icon: TimerReset },
  { path: "/progress", label: "Mint progress", icon: TimerReset },
  { path: "/certificate", label: "Certificate", icon: Check }
];

function PlaceholderScreen({ title, description, next, nextLabel }: {
  title: string;
  description: string;
  next?: string;
  nextLabel?: string;
}) {
  const navigate = useNavigate();
  return (
    <main className="stub-screen">
      <button className="back-button" onClick={() => navigate("/")}><ChevronLeft size={20} /> Start over</button>
      <div className="stub-panel">
        <div className="stub-kicker">Kiosk flow / placeholder</div>
        <h1>{title}</h1>
        <p>{description}</p>
        {next && <button className="primary-action" onClick={() => navigate(next)}>{nextLabel} <Check size={20} /></button>}
      </div>
    </main>
  );
}

function IdleReset() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let timer = window.setTimeout(() => navigate("/", { replace: true }), kioskConfig.idleTimeoutMs);
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => navigate("/", { replace: true }), kioskConfig.idleTimeoutMs);
    };
    const events = ["pointerdown", "pointermove", "keydown", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [location.pathname, navigate]);

  return null;
}

function FlowHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname === "/") return null;
  const activeIndex = Math.max(0, screens.findIndex((screen) => screen.path === location.pathname));
  return (
    <header className="flow-header">
      <button className="brand-mark" onClick={() => navigate("/")} aria-label="Return to attract screen">GW</button>
      <div className="flow-steps" aria-label="Kiosk progress">
        {screens.map((screen, index) => (
          <div className={`flow-step ${index <= activeIndex ? "is-active" : ""}`} key={screen.path}>
            <span>{index + 1}</span>{screen.label}
          </div>
        ))}
      </div>
      <button className="reset-button" onClick={() => navigate("/")}>Reset</button>
    </header>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <IdleReset />
      <FlowHeader />
      <AnimatePresence mode="wait">
        <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <Routes>
            <Route path="/" element={<Attract onStart={() => navigate("/draw")} />} />
            <Route path="/draw" element={<Draw />} />
            <Route path="/nickname" element={<PlaceholderScreen title="Choose a nickname" description="A short handle is all we need. No real names, no wallet, no friction." next="/progress" nextLabel="Mint my art" />} />
            <Route path="/progress" element={<PlaceholderScreen title="Your mark is moving" description="Hashing, uploading, minting, and confirmation states will appear here." next="/certificate" nextLabel="View certificate" />} />
            <Route path="/certificate" element={<PlaceholderScreen title="Proof complete" description="Your artwork, token ID, transaction, and QR certificate will appear here." />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}