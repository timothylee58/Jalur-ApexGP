import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { circuitPath, circuitViewBox } from "@/data/sepangCircuit";
import { parseOgCard, type StrategyRead } from "@/lib/ogCard";
import { TYRE_COLOR } from "@/lib/tyreColors";
import type { Compound } from "@/types";

// Renders a shareable 1200×630 strategy card from the same query params the
// share link encodes (see lib/predictionUtils.buildShareUrl). Used both as the
// og:image for shared /predict links and as a directly openable image.
//
// The renderer (Satori) is stricter than a browser: any element with more
// than one child must be `display: flex`, or the whole response fails with
// a 500. Every multi-child element below sets it, text is always a single
// string, and lib/ogCard.test.ts renders every parameter combination.
export const runtime = "nodejs";

const ASPHALT = "#14181c";
const CARBON = "#0a0c0e";
const PAPER = "#f4efe6";
const PAPER_DIM = "#a39b8f";
const HAIRLINE = "rgba(244, 239, 230, 0.12)";
const AMBER = "#f5a623";
const TEAL = "#2ec4b6";

type FontSpec = { name: string; file: string; weight: 400 | 500 | 600 };
const FONT_SPECS: FontSpec[] = [
  { name: "Geist", file: "Geist-Regular.ttf", weight: 400 },
  { name: "Geist", file: "Geist-SemiBold.ttf", weight: 600 },
  { name: "Geist Mono", file: "GeistMono-Medium.ttf", weight: 500 },
  { name: "Bebas Neue", file: "BebasNeue-Regular.woff", weight: 400 },
];

// The site's own typefaces, bundled (SIL OFL, licences alongside) and read
// once per server instance. Missing files degrade to the renderer's default
// font rather than failing the card.
let fontsPromise: Promise<{ name: string; data: Buffer; weight: FontSpec["weight"]; style: "normal" }[]> | null =
  null;
function loadFonts() {
  fontsPromise ??= Promise.all(
    FONT_SPECS.map(async (spec) => ({
      name: spec.name,
      data: await readFile(join(process.cwd(), "app/og/fonts", spec.file)),
      weight: spec.weight,
      style: "normal" as const,
    })),
  ).catch(() => {
    fontsPromise = null;
    return [];
  });
  return fontsPromise;
}

function Chip({ children, accent }: { children: string; accent?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "7px 16px",
        borderRadius: 999,
        border: `1.5px solid ${accent ?? HAIRLINE}`,
        background: accent ? accent : "transparent",
        color: accent ? CARBON : PAPER,
        fontFamily: "Geist Mono",
        fontSize: 16,
        letterSpacing: 2,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

/** A compound as its sidewall: a coloured ring around the initial. */
function TyreDot({ compound, size }: { compound: Compound; size: number }) {
  const colour = TYRE_COLOR[compound];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size,
        border: `${Math.round(size * 0.15)}px solid ${colour}`,
        background: CARBON,
        color: colour,
        fontFamily: "Geist",
        fontWeight: 600,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {compound.charAt(0)}
    </div>
  );
}

function Strategy({
  title,
  accent,
  read,
  stronger,
}: {
  title: string;
  accent: string;
  read: StrategyRead;
  stronger: boolean;
}) {
  const confidence = read.confidence;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Fixed height, so both columns line up whether or not the badge shows. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 28 }}>
        <div style={{ color: accent, fontFamily: "Geist Mono", fontSize: 17, letterSpacing: 4 }}>{title}</div>
        {stronger ? (
          <div
            style={{
              display: "flex",
              color: accent,
              border: `1.5px solid ${accent}`,
              borderRadius: 999,
              padding: "3px 12px",
              fontFamily: "Geist Mono",
              fontSize: 13,
              letterSpacing: 2,
            }}
          >
            STRONGER READ
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
        {read.stints.length ? (
          read.stints.map((stint, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 ? <div style={{ width: 26, height: 2, background: HAIRLINE, margin: "0 8px" }} /> : null}
              <TyreDot compound={stint.compound} size={44} />
            </div>
          ))
        ) : (
          <div style={{ color: PAPER_DIM, fontSize: 22 }}>No tyre plan in this link</div>
        )}
      </div>
      {/* Full names for a one- or two-stint plan; short ones (and a
          smaller size) past that, so even four stints stay on one line. */}
      <div style={{ color: PAPER, fontSize: read.stints.length > 2 ? 22 : 26, marginTop: 12 }}>
        {read.stints.map((s) => (read.stints.length > 2 ? s.short : s.compound)).join("  →  ") || " "}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", marginTop: "auto" }}>
        <div
          style={{
            color: confidence === null ? PAPER_DIM : accent,
            fontFamily: "Bebas Neue",
            fontSize: 118,
            lineHeight: 0.8,
          }}
        >
          {confidence === null ? "—" : String(confidence)}
        </div>
        {confidence === null ? null : (
          <div style={{ color: accent, fontFamily: "Bebas Neue", fontSize: 52, lineHeight: 0.8, marginLeft: 4 }}>%</div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 16,
            color: PAPER_DIM,
            fontFamily: "Geist Mono",
            fontSize: 13,
            letterSpacing: 2,
            lineHeight: 1.3,
          }}
        >
          <div>MODEL</div>
          <div>CONFIDENCE</div>
        </div>
      </div>
      <div style={{ display: "flex", height: 6, marginTop: 14, borderRadius: 6, background: HAIRLINE }}>
        <div style={{ width: `${confidence ?? 0}%`, height: 6, borderRadius: 6, background: accent }} />
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const card = parseOgCard(request.nextUrl.searchParams);
  const fonts = await loadFonts();
  const conditions = [
    card.condition,
    card.tempC === null ? null : `${card.tempC}°C`,
    card.rain === null ? null : `Rain ${card.rain}%`,
  ].filter((c): c is string => c !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "48px 64px 40px",
          background: `radial-gradient(circle at 88% 12%, #1d2328 0%, ${ASPHALT} 55%)`,
          color: PAPER,
          fontFamily: "Geist",
        }}
      >
        {/* Sepang itself, faint behind the header — the card's one flourish. */}
        <svg
          viewBox={circuitViewBox}
          width={520}
          height={520}
          style={{ position: "absolute", right: -60, top: -40, opacity: 0.07 }}
        >
          <path d={circuitPath} fill="none" stroke={PAPER} strokeWidth={14} strokeLinejoin="round" />
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 28, height: 4, background: AMBER, marginRight: 14 }} />
              <div style={{ fontWeight: 600, fontSize: 26, letterSpacing: 5 }}>JALUR APEXGP</div>
            </div>
            <div
              style={{ color: PAPER_DIM, fontFamily: "Geist Mono", fontSize: 15, letterSpacing: 3, marginTop: 10 }}
            >
              SEPANG INTERNATIONAL CIRCUIT · STRATEGY READ
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontFamily: "Bebas Neue", fontSize: 104, lineHeight: 0.8 }}>{card.session}</div>
            <div
              style={{ color: PAPER_DIM, fontFamily: "Geist Mono", fontSize: 14, letterSpacing: 3, marginTop: 8 }}
            >
              {card.sessionName.toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
          {conditions.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          {card.safetyCar ? <Chip accent={AMBER}>Safety car</Chip> : null}
          {card.startTyre ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "5px 16px 5px 6px",
                borderRadius: 999,
                border: `1.5px solid ${HAIRLINE}`,
                color: PAPER,
                fontFamily: "Geist Mono",
                fontSize: 16,
                letterSpacing: 2,
              }}
            >
              <TyreDot compound={card.startTyre} size={26} />
              <div style={{ marginLeft: 10 }}>{`START ON ${card.startTyre.toUpperCase()}`}</div>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flex: 1, marginTop: 28, paddingTop: 26, borderTop: `1px solid ${HAIRLINE}` }}>
          <Strategy
            title="CONSERVATIVE"
            accent={AMBER}
            read={card.conservative}
            stronger={card.stronger === "conservative"}
          />
          <div style={{ width: 1, background: HAIRLINE, margin: "0 44px" }} />
          <Strategy
            title="AGGRESSIVE"
            accent={TEAL}
            read={card.aggressive}
            stronger={card.stronger === "aggressive"}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 26,
            color: PAPER_DIM,
            fontSize: 15,
          }}
        >
          <div style={{ fontFamily: "Geist Mono", letterSpacing: 1 }}>{`${request.nextUrl.host}/predict`}</div>
          <div>Unofficial fan project · not affiliated with F1, FIA or SIC</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
