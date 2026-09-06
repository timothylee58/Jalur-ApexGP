import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useGLTF } from "@react-three/drei";
import "./index.css";
import App from "./App.tsx";

// Self-hosted decoder (symlinked from frontend/public/draco/, copied there
// from three's own package) — matches production, never Google's CDN.
// Must be set before any useGLTF(..., true) call fires.
useGLTF.setDecoderPath("/draco/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
