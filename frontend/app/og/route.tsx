import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// Renders a shareable 1200×630 strategy card from the same query params the
// share link encodes (see lib/predictionUtils.buildShareUrl). Used both as the
// og:image for shared /predict links and as a directly openable image.
export const runtime = "nodejs";

const ASPHALT = "#14181c";
const CARBON = "#0a0c0e";
const PAPER = "#f4efe6";
const PAPER_DIM = "#a39b8f";
const AMBER = "#f5a623";
const TEAL = "#2ec4b6";

function tyres(value: string | null): string {
  if (!value) return "—";
  return value.split("-").join(" → ");
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const session = params.get("session") ?? "Race";
  const cc = params.get("cc") ?? "—";
  const ac = params.get("ac") ?? "—";
  const rain = params.get("rain");
  const temp = params.get("temp");
  const cond = params.get("cond") ?? "Sepang weekend";
  const ct = tyres(params.get("ct"));
  const at = tyres(params.get("at"));
  const sc = params.get("sc") === "1";
  const ty = params.get("ty");

  const weatherLine = [cond, temp ? `${temp}°C` : null, rain ? `rain ${rain}%` : null]
    .filter(Boolean)
    .join("  ·  ");

  const column = (
    title: string,
    accent: string,
    seq: string,
    confidence: string,
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        border: `2px solid ${accent}`,
        borderRadius: 20,
        padding: "28px 32px",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ color: accent, fontSize: 24, letterSpacing: 4, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ color: PAPER, fontSize: 46, fontWeight: 700, marginTop: 12 }}>{seq}</div>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: "auto", gap: 10 }}>
        <div style={{ color: accent, fontSize: 72, fontWeight: 800 }}>{confidence}</div>
        <div style={{ color: PAPER_DIM, fontSize: 30 }}>% confidence</div>
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: ASPHALT,
          padding: 56,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: AMBER, fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>
              JALUR APEXGP
            </div>
            <div style={{ color: PAPER_DIM, fontSize: 20, letterSpacing: 4, textTransform: "uppercase" }}>
              Sepang · Strategy Simulator
            </div>
          </div>
          <div style={{ color: PAPER, fontSize: 64, fontWeight: 800, textTransform: "uppercase" }}>
            {session}
          </div>
        </div>

        <div style={{ color: PAPER, fontSize: 30, marginTop: 18 }}>{weatherLine}</div>

        {sc || ty ? (
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {sc ? (
              <div
                style={{
                  color: CARBON,
                  background: AMBER,
                  fontSize: 22,
                  fontWeight: 700,
                  padding: "6px 16px",
                  borderRadius: 999,
                }}
              >
                SAFETY CAR
              </div>
            ) : null}
            {ty ? (
              <div
                style={{
                  color: AMBER,
                  border: `2px solid ${AMBER}`,
                  fontSize: 22,
                  fontWeight: 700,
                  padding: "6px 16px",
                  borderRadius: 999,
                }}
              >
                START: {ty.toUpperCase()}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 28, marginTop: 28, flex: 1 }}>
          {column("Conservative", AMBER, ct, cc)}
          {column("Aggressive", TEAL, at, ac)}
        </div>

        <div style={{ color: PAPER_DIM, fontSize: 20, marginTop: 24 }}>
          Deterministic weather + tyre-life simulator · unofficial fan project, not affiliated with
          F1 / FIA / SIC
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
