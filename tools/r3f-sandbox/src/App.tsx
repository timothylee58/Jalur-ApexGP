import { useState } from "react";
import { OrbitSepangScene } from "./scenes/OrbitSepangScene";
import { CircuitExplorerScene } from "./scenes/CircuitExplorerScene";
import { CalibrateScene } from "./scenes/CalibrateScene";

type SceneKey = "orbit-sepang" | "circuit-explorer" | "calibrate";

const SCENES: Record<SceneKey, { label: string; render: () => React.ReactNode }> = {
  "orbit-sepang": {
    label: "Orbit Sepang (landing page)",
    render: () => <OrbitSepangScene />,
  },
  "circuit-explorer": {
    label: "Circuit explorer (/circuit)",
    render: () => <CircuitExplorerScene />,
  },
  calibrate: {
    label: "Calibrate terrain",
    render: () => <CalibrateScene />,
  },
};

export default function App() {
  const [active, setActive] = useState<SceneKey>("orbit-sepang");

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid #2a3036",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <strong style={{ color: "#f5a623" }}>R3F sandbox</strong>
        <span style={{ opacity: 0.5 }}>—</span>
        {(Object.keys(SCENES) as SceneKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            style={{
              background: active === key ? "#f5a623" : "transparent",
              color: active === key ? "#0a0c0e" : "#a39b8f",
              border: "1px solid #2a3036",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {SCENES[key].label}
          </button>
        ))}
      </header>
      <div style={{ flex: 1, position: "relative" }}>{SCENES[active].render()}</div>
    </div>
  );
}
