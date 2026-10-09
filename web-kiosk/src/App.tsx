import { Check, ChevronLeft, Palette, TimerReset } from "lucide-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Attract } from "./pages/Attract";
import { Draw } from "./pages/Draw";
import { Nickname } from "./pages/Nickname";
import { Progress } from "./pages/Progress";
import { Certificate } from "./pages/Certificate";

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

function FlowHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname === "/") return null;
  const activeIndex = Math.max(0, screens.findIndex((screen) => screen.path === location.pathname));
  return (
    <header className="flow-header">
      <button className="brand-mark" onClick={() => navigate("/")} aria-label="Return to attract screen"><img src="/logo.png" alt="" /></button>
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
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <FlowHeader />
      <Routes>
        <Route path="/" element={<Attract onStart={() => navigate("/draw")} />} />
        <Route path="/draw" element={<Draw />} />
        <Route path="/nickname" element={<Nickname />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/certificate" element={<Certificate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
