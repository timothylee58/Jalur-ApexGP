import {
  circuitMarkers,
  circuitPath,
  circuitViewBox,
  startFinish,
} from "@/data/sepangCircuit";

interface SepangCircuitMapProps {
  /** Corner codes to highlight (e.g. ["T1","T9"]) — matches referencedCorners. */
  highlighted?: string[];
  className?: string;
  /** Faded, decorative-only rendering for use as a background (e.g. the hero). */
  muted?: boolean;
}

export function SepangCircuitMap({
  highlighted = [],
  className,
  muted = false,
}: SepangCircuitMapProps) {
  const active = new Set(highlighted);
  const trackColor = muted ? "#2a3036" : "#3a4048";

  return (
    <svg
      viewBox={circuitViewBox}
      className={className}
      role="img"
      aria-label={
        highlighted.length > 0
          ? `Sepang circuit map highlighting ${highlighted.join(", ")}`
          : "Sepang International Circuit map"
      }
    >
      {/* Track ribbon: a wide dark stroke under a thin centre line. */}
      <path d={circuitPath} fill="none" stroke={trackColor} strokeWidth={26} strokeLinejoin="round" />
      <path
        d={circuitPath}
        fill="none"
        stroke={muted ? "#3a4048" : "#5b636d"}
        strokeWidth={2}
        strokeDasharray="2 12"
        strokeLinecap="round"
      />

      {/* Start/finish tick. */}
      {!muted ? (
        <circle cx={startFinish.x} cy={startFinish.y} r={9} fill="#f4efe6" stroke="#14181c" strokeWidth={2} />
      ) : null}

      {!muted
        ? circuitMarkers.map((marker) => {
            const on = marker.code !== null && active.has(marker.code);
            return (
              <g key={marker.label}>
                {on ? (
                  <circle cx={marker.x} cy={marker.y} r={26} fill="#f5a623" opacity={0.18} />
                ) : null}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={on ? 11 : 7}
                  fill={on ? "#f5a623" : "#14181c"}
                  stroke={on ? "#f5a623" : "#5b636d"}
                  strokeWidth={2}
                />
                <text
                  x={marker.x}
                  y={marker.y - 22}
                  textAnchor="middle"
                  fontSize={30}
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight={700}
                  fill={on ? "#f5a623" : "#a39b8f"}
                >
                  {marker.label}
                </text>
              </g>
            );
          })
        : null}
    </svg>
  );
}
