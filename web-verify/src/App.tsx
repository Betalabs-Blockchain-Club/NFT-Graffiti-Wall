import { HashRouter, Route, Routes } from "react-router-dom";
import { VerifyToken } from "./pages/VerifyToken";
function Landing() { return <main className="page"><section className="loading-card"><p className="eyebrow">NFT GRAFFITI WALL</p><h1>Verify an artwork</h1><p>Open the verification link from an artwork’s QR certificate.</p></section></main>; }
export default function App() { return <HashRouter><a className="verify-brand" href="/" aria-label="NFT Graffiti Wall home"><img src="/logo.png" alt="NFT Graffiti Wall" /></a><Routes><Route path="/token/:tokenId" element={<VerifyToken />} /><Route path="*" element={<Landing />} /></Routes></HashRouter>; }
