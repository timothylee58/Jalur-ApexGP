"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { circuitPath, startFinish } from "@/data/sepangCircuit";

/**
 * An original, interactive "general map" for /tickets — the real track
 * centreline (data/sepangCircuit.ts) inset into a wider canvas, surrounded
 * by the circuit grounds' actual facilities (paddock building, driving
 * experience centre, go-kart track, parking bays, etc.), all drawn as this
 * app's own house-style iconography rather than a copy of Sepang
 * International Circuit's own published general-map graphic. The *facts*
 * this draws from (which facilities exist, their rough arrangement around
 * the track, the parking-bay lettering/numbering) are the same kind of
 * organiser-sourced facts SeatFinder.tsx already treats as fair to read
 * off official materials and verify — see docs/BRAND.md's "External
 * content" section; the map's own specific artistic rendering isn't
 * reproduced, only redrawn from scratch here. Grandstand/hillstand
 * positions stay exactly the WebSearch-verified real apex-point
 * coordinates the rest of the app uses (see SeatFinder.tsx); the
 * surrounding facility/parking layout is illustrative, not to survey
 * scale — labelled as such in this page's caption, the same honesty
 * standard other approximated data in this app holds itself to.
 */

export interface StandMapMarker {
  id: string;
  /** Short label drawn on the map, e.g. "K2", "F", "Main". */
  code: string;
  /** Track-space position (0-1000), same as pointForName() in sepangCircuit.ts. */
  x: number;
  y: number;
  kind: "grandstand" | "hillstand";
  selected?: boolean;
  name: string;
  priceLabel: string;
  overlook?: string | null;
}

type LandmarkKind = "facility" | "transport" | "amenity";

interface Landmark {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: LandmarkKind;
  description: string;
}

type LegendKind = "grandstand" | "hillstand" | LandmarkKind | "parking";

const KIND_COLOR: Record<LegendKind, string> = {
  grandstand: "#f5a623",
  hillstand: "#f5a623",
  facility: "#7ec8e3",
  transport: "#9ad46a",
  amenity: "#e08fb6",
  parking: "#a39b8f",
};

const LEGEND: { kind: LegendKind; label: string }[] = [
  { kind: "grandstand", label: "Grandstand" },
  { kind: "hillstand", label: "Hillstand" },
  { kind: "facility", label: "Circuit facility" },
  { kind: "transport", label: "Transport" },
  { kind: "amenity", label: "Amenity" },
  { kind: "parking", label: "Parking bay" },
];

interface ParkingBay {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface HoverInfo {
  title: string;
  body?: string;
  x: number;
  y: number;
}

// ---- layout -------------------------------------------------------------
// The real centreline lives in its own 0-1000 square (sepangCircuit.ts);
// inset it via an SVG transform (scale + translate) rather than
// recomputing any coordinates, leaving room around it for the facility
// landmarks and parking bays below, placed at their real rough
// arrangement relative to the track.
const VIEW_W = 1160;
const VIEW_H = 820;
export const GENERAL_MAP_VIEW_BOX = `0 0 ${VIEW_W} ${VIEW_H}`;
const TRACK_SCALE = 0.58;
const TRACK_TX = 380;
const TRACK_TY = 150;

function toOuter(x: number, y: number) {
  return { x: TRACK_TX + x * TRACK_SCALE, y: TRACK_TY + y * TRACK_SCALE };
}

const LANDMARKS: Landmark[] = [
  {
    id: "accreditation",
    label: "Accreditation Centre",
    x: 665,
    y: 90,
    kind: "facility",
    description: "Race-weekend pass pickup, and paddock & pit access — the north gate above the pit straight.",
  },
  {
    id: "motorsport-park",
    label: "SIC Motorsport Park",
    x: 760,
    y: 200,
    kind: "facility",
    description: "Multi-use motorsport facility on the circuit grounds, separate from the Grand Prix track.",
  },
  {
    id: "driving-experience",
    label: "Driving Experience Centre",
    x: 480,
    y: 195,
    kind: "amenity",
    description: "Guided and self-drive experience circuit for visitors.",
  },
  {
    id: "go-kart",
    label: "Go Kart",
    x: 355,
    y: 275,
    kind: "amenity",
    description: "Public go-kart track on the SIC grounds.",
  },
  {
    id: "paddock-pit",
    label: "Paddock / Pit Building",
    x: 700,
    y: 430,
    kind: "facility",
    description: "Team garages and pit lane — the infield building the main straight runs past.",
  },
  {
    id: "south-paddock",
    label: "South Paddock",
    x: 745,
    y: 545,
    kind: "facility",
    description: "Secondary paddock area south of the pit building.",
  },
  {
    id: "mall-welcome",
    label: "Welcome Centre & Mall Area",
    x: 545,
    y: 470,
    kind: "amenity",
    description: "Visitor welcome centre and retail area behind the Main Grandstand.",
  },
  {
    id: "helipad",
    label: "Helipad",
    x: 210,
    y: 480,
    kind: "transport",
    description: "Helicopter landing pad on the west side of the circuit grounds.",
  },
  {
    id: "bus",
    label: "Bus",
    x: 225,
    y: 530,
    kind: "transport",
    description: "Bus set-down and parking.",
  },
  {
    id: "taxi",
    label: "Taxi",
    x: 250,
    y: 400,
    kind: "transport",
    description: "Taxi rank.",
  },
  {
    id: "petronas",
    label: "Petronas Station",
    x: 95,
    y: 490,
    kind: "amenity",
    description: "Fuel station just outside the west gate.",
  },
];

const PARKING_BAYS: ParkingBay[] = [
  { id: "bay-1", label: "1", x: 430, y: 330 },
  { id: "bay-2", label: "2", x: 265, y: 620 },
  { id: "bay-3", label: "3", x: 335, y: 570 },
  { id: "bay-4", label: "4", x: 570, y: 655 },
  { id: "bay-5", label: "5", x: 640, y: 700 },
  { id: "bay-6", label: "6", x: 705, y: 730 },
  { id: "bay-7", label: "7", x: 775, y: 720 },
  { id: "bay-8", label: "8", x: 935, y: 655 },
  { id: "bay-9", label: "9", x: 985, y: 590 },
  { id: "bay-12", label: "12", x: 1035, y: 430 },
  { id: "bay-14", label: "14", x: 1010, y: 290 },
  { id: "bay-15", label: "15", x: 960, y: 220 },
  { id: "bay-17", label: "17", x: 900, y: 105 },
  { id: "bay-o", label: "O", x: 630, y: 150 },
  { id: "bay-perdana", label: "Perdana", x: 715, y: 125 },
  { id: "bay-sic", label: "SIC", x: 390, y: 415 },
  { id: "bay-pa1", label: "PA1", x: 320, y: 490 },
  { id: "bay-x", label: "X", x: 455, y: 610 },
];

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function MapTooltip({ hover }: { hover: HoverInfo }) {
  const width = 280;
  const bodyLines = hover.body ? wrapText(hover.body, 30) : [];
  const height = bodyLines.length > 0 ? 40 + bodyLines.length * 16 : 40;
  const x = Math.min(Math.max(hover.x - width / 2, 10), VIEW_W - width - 10);
  const above = hover.y - height - 16;
  const y = above < 10 ? hover.y + 16 : above;

  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={width} height={height} rx={6} fill="#14181c" stroke="#f5a623" strokeWidth={1.5} />
      <text
        x={x + 14}
        y={y + 24}
        fontFamily="var(--font-display), sans-serif"
        fontSize={16}
        letterSpacing={1}
        fill="#f4efe6"
      >
        {hover.title}
      </text>
      {bodyLines.map((line, i) => (
        <text
          key={i}
          x={x + 14}
          y={y + 42 + i * 16}
          fontFamily="var(--font-geist-mono), monospace"
          fontSize={12}
          fill="#a39b8f"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

interface GeneralCircuitMapProps {
  stands: StandMapMarker[];
  onSelectStand?: (id: string) => void;
  className?: string;
}

function LandmarkIcon({ kind, x, y, active }: { kind: LandmarkKind; x: number; y: number; active: boolean }) {
  const color = KIND_COLOR[kind];
  const fill = active ? color : "#14181c";
  const r = active ? 9 : 7;
  if (kind === "transport") {
    return (
      <polygon
        points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
        fill={fill}
        stroke={color}
        strokeWidth={1.75}
      />
    );
  }
  if (kind === "amenity") {
    return <circle cx={x} cy={y} r={r - 1} fill={fill} stroke={color} strokeWidth={1.75} />;
  }
  return (
    <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={2.5} fill={fill} stroke={color} strokeWidth={1.75} />
  );
}

export function GeneralCircuitMap({ stands, onSelectStand, className }: GeneralCircuitMapProps) {
  const titleId = useId();
  const gridId = useId();
  const glowId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<LegendKind | null>(null);

  const activate = (id: string) => setActiveId(id);
  const deactivate = (id: string) => setActiveId((current) => (current === id ? null : current));
  const toggle = (id: string) => setActiveId((current) => (current === id ? null : id));
  const onKeyActivate = (onActivate: () => void) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
  // Spotlighting a legend category dims everything else so one layer
  // of the map can be read at a glance; the active (hovered) item is
  // never dimmed so tooltips still point at a visible target.
  const dimmed = (kind: LegendKind, id: string) => spotlight !== null && spotlight !== kind && activeId !== id;
  const layerOpacity = (kind: LegendKind, id: string) => (dimmed(kind, id) ? 0.18 : 1);

  let hover: HoverInfo | null = null;
  const activeStand = stands.find((s) => s.id === activeId);
  const activeLandmark = LANDMARKS.find((l) => l.id === activeId);
  const activeBay = PARKING_BAYS.find((b) => b.id === activeId);
  if (activeStand) {
    const o = toOuter(activeStand.x, activeStand.y);
    hover = {
      title: activeStand.name,
      body: [activeStand.priceLabel, activeStand.overlook ? `Overlooks ${activeStand.overlook}` : null]
        .filter(Boolean)
        .join(" · "),
      x: o.x,
      y: o.y,
    };
  } else if (activeLandmark) {
    hover = { title: activeLandmark.label, body: activeLandmark.description, x: activeLandmark.x, y: activeLandmark.y };
  } else if (activeBay) {
    hover = { title: `Parking Bay ${activeBay.label}`, x: activeBay.x, y: activeBay.y };
  }

  const sf = toOuter(startFinish.x, startFinish.y);

  return (
    <svg viewBox={GENERAL_MAP_VIEW_BOX} className={className} aria-labelledby={titleId}>
      <title id={titleId}>
        Sepang International Circuit general map — grandstands, facilities, and parking
      </title>
      <defs>
        <pattern id={gridId} width={40} height={40} patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#f4efe6" strokeOpacity={0.045} strokeWidth={1} />
        </pattern>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={10} />
        </filter>
      </defs>
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#14181c" />
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={`url(#${gridId})`} />

      <text
        x={26}
        y={46}
        fontFamily="var(--font-display), sans-serif"
        fontSize={32}
        letterSpacing={2}
        fill="#f4efe6"
      >
        GENERAL MAP
      </text>
      <text
        x={26}
        y={68}
        fontFamily="var(--font-geist-mono), monospace"
        fontSize={11}
        letterSpacing={2}
        fill="#a39b8f"
      >
        SEPANG INTERNATIONAL CIRCUIT · 5.543 KM · 15 TURNS
      </text>

      {/* Legend — hover/focus a row to spotlight that layer of the map. */}
      <g transform={`translate(26 ${VIEW_H - 24 - LEGEND.length * 22})`} aria-label="Legend">
        {LEGEND.map((entry, i) => {
          const y = i * 22;
          const color = KIND_COLOR[entry.kind];
          const on = spotlight === entry.kind;
          const faded = spotlight !== null && !on;
          return (
            <g
              key={entry.kind}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`Highlight ${entry.label.toLowerCase()}s on the map`}
              onMouseEnter={() => setSpotlight(entry.kind)}
              onMouseLeave={() => setSpotlight((cur) => (cur === entry.kind ? null : cur))}
              onFocus={() => setSpotlight(entry.kind)}
              onBlur={() => setSpotlight((cur) => (cur === entry.kind ? null : cur))}
              onClick={() => setSpotlight((cur) => (cur === entry.kind ? null : entry.kind))}
              onKeyDown={onKeyActivate(() => setSpotlight((cur) => (cur === entry.kind ? null : entry.kind)))}
              style={{ cursor: "pointer" }}
              opacity={faded ? 0.4 : 1}
            >
              <rect x={-8} y={y - 11} width={170} height={22} rx={4} fill={on ? "#f4efe6" : "transparent"} opacity={on ? 0.06 : 1} />
              {entry.kind === "grandstand" ? (
                <rect x={-5} y={y - 5} width={10} height={10} rx={2} fill="none" stroke={color} strokeWidth={2} />
              ) : entry.kind === "hillstand" ? (
                <polygon points={`0,${y - 6} 6,${y + 5} -6,${y + 5}`} fill="none" stroke={color} strokeWidth={2} />
              ) : entry.kind === "parking" ? (
                <rect x={-6} y={y - 6} width={12} height={12} rx={2} fill="#14181c" stroke={color} strokeWidth={1.5} />
              ) : (
                <LandmarkIcon kind={entry.kind} x={0} y={y} active={false} />
              )}
              <text
                x={16}
                y={y + 4}
                fontFamily="var(--font-geist-mono), monospace"
                fontSize={11}
                letterSpacing={0.5}
                fill={on ? "#f4efe6" : "#a39b8f"}
              >
                {entry.label}
              </text>
            </g>
          );
        })}
      </g>

      {/* Compass. */}
      <g transform={`translate(${VIEW_W - 60} ${VIEW_H - 68})`}>
        <circle r={22} fill="none" stroke="#5b636d" strokeWidth={2} />
        <path d="M0,-16 L6,6 L0,0 L-6,6 Z" fill="#f4efe6" />
        <text
          y={-30}
          textAnchor="middle"
          fontFamily="var(--font-geist-mono), monospace"
          fontSize={13}
          fill="#a39b8f"
        >
          N
        </text>
      </g>

      {/* Track + grandstand/hillstand zones, inset. */}
      <g transform={`translate(${TRACK_TX} ${TRACK_TY}) scale(${TRACK_SCALE})`}>
        <path d={circuitPath} fill="none" stroke="#f5a623" strokeOpacity={0.12} strokeWidth={44} filter={`url(#${glowId})`} />
        <path d={circuitPath} fill="#1a1f25" fillOpacity={0.6} stroke="#5b636d" strokeWidth={34} strokeLinejoin="round" />
        <path d={circuitPath} fill="none" stroke="#2c323a" strokeWidth={26} strokeLinejoin="round" />
        <path
          d={circuitPath}
          fill="none"
          stroke="#8a929c"
          strokeWidth={2}
          strokeDasharray="2 12"
          strokeLinecap="round"
        />

        {/* Start / finish line. */}
        <g transform={`translate(${startFinish.x} ${startFinish.y})`} pointerEvents="none">
          <rect x={-3} y={-18} width={6} height={36} fill="#f4efe6" />
          <rect x={-3} y={-18} width={3} height={6} fill="#14181c" />
          <rect x={0} y={-12} width={3} height={6} fill="#14181c" />
          <rect x={-3} y={-6} width={3} height={6} fill="#14181c" />
          <rect x={0} y={0} width={3} height={6} fill="#14181c" />
          <rect x={-3} y={6} width={3} height={6} fill="#14181c" />
          <rect x={0} y={12} width={3} height={6} fill="#14181c" />
        </g>

        {stands.map((stand) => {
          const isActive = activeId === stand.id;
          const color = stand.selected ? "#f5a623" : "#d8d0c4";
          const size = stand.selected ? 22 : 15;
          const select = () => {
            onSelectStand?.(stand.id);
            activate(stand.id);
          };
          return (
            <g
              key={stand.id}
              role="button"
              tabIndex={0}
              aria-pressed={!!stand.selected}
              aria-label={`${stand.name}, ${stand.priceLabel}`}
              onClick={select}
              onMouseEnter={() => activate(stand.id)}
              onMouseLeave={() => deactivate(stand.id)}
              onFocus={() => activate(stand.id)}
              onBlur={() => deactivate(stand.id)}
              onKeyDown={onKeyActivate(select)}
              style={{ cursor: "pointer", transition: "opacity 150ms" }}
              opacity={layerOpacity(stand.kind, stand.id)}
            >
              {stand.selected || isActive ? (
                <>
                  <circle cx={stand.x} cy={stand.y} r={40} fill="#f5a623" opacity={0.12} />
                  <circle cx={stand.x} cy={stand.y} r={30} fill="none" stroke="#f5a623" strokeWidth={1.5} opacity={0.5} />
                </>
              ) : null}
              {stand.kind === "grandstand" ? (
                <rect
                  x={stand.x - size / 2}
                  y={stand.y - size / 2}
                  width={size}
                  height={size}
                  rx={3}
                  fill={stand.selected ? "#f5a623" : "#14181c"}
                  stroke={color}
                  strokeWidth={2.5}
                />
              ) : (
                <polygon
                  points={`${stand.x},${stand.y - size * 0.6} ${stand.x - size * 0.55},${stand.y + size * 0.5} ${stand.x + size * 0.55},${stand.y + size * 0.5}`}
                  fill={stand.selected ? "#f5a623" : "#14181c"}
                  stroke={color}
                  strokeWidth={2.5}
                />
              )}
              <text
                x={stand.x}
                y={stand.y - size - 8}
                textAnchor="middle"
                fontSize={24}
                fontFamily="var(--font-geist-mono), monospace"
                fontWeight={700}
                fill={color}
                stroke="#14181c"
                strokeWidth={5}
                paintOrder="stroke"
              >
                {stand.code}
              </text>
            </g>
          );
        })}
      </g>

      {/* Facility landmarks. */}
      {LANDMARKS.map((lm) => {
        const isActive = activeId === lm.id;
        const color = KIND_COLOR[lm.kind];
        return (
          <g
            key={lm.id}
            role="button"
            tabIndex={0}
            aria-label={`${lm.label}: ${lm.description}`}
            onClick={() => toggle(lm.id)}
            onMouseEnter={() => activate(lm.id)}
            onMouseLeave={() => deactivate(lm.id)}
            onFocus={() => activate(lm.id)}
            onBlur={() => deactivate(lm.id)}
            onKeyDown={onKeyActivate(() => toggle(lm.id))}
            style={{ cursor: "pointer", transition: "opacity 150ms" }}
            opacity={layerOpacity(lm.kind, lm.id)}
          >
            {isActive ? <circle cx={lm.x} cy={lm.y} r={18} fill={color} opacity={0.15} /> : null}
            <LandmarkIcon kind={lm.kind} x={lm.x} y={lm.y} active={isActive} />
            <text
              x={lm.x}
              y={lm.y - 15}
              textAnchor="middle"
              fontSize={12}
              fontFamily="var(--font-geist-mono), monospace"
              fontWeight={isActive ? 700 : 400}
              fill={isActive ? "#f4efe6" : "#d8d0c4"}
              stroke="#14181c"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {lm.label}
            </text>
          </g>
        );
      })}

      {/* Parking bays. */}
      {PARKING_BAYS.map((bay) => {
        const isActive = activeId === bay.id;
        return (
          <g
            key={bay.id}
            role="button"
            tabIndex={0}
            aria-label={`Parking Bay ${bay.label}`}
            onClick={() => toggle(bay.id)}
            onMouseEnter={() => activate(bay.id)}
            onMouseLeave={() => deactivate(bay.id)}
            onFocus={() => activate(bay.id)}
            onBlur={() => deactivate(bay.id)}
            onKeyDown={onKeyActivate(() => toggle(bay.id))}
            style={{ cursor: "pointer", transition: "opacity 150ms" }}
            opacity={layerOpacity("parking", bay.id)}
          >
            <rect
              x={bay.x - 13}
              y={bay.y - 13}
              width={26}
              height={26}
              rx={4}
              fill={isActive ? "#f5a623" : "#1a1f25"}
              stroke={isActive ? "#f5a623" : "#6b7480"}
              strokeWidth={1.5}
            />
            <text
              x={bay.x}
              y={bay.y - 16}
              textAnchor="middle"
              fontSize={7}
              fontFamily="var(--font-geist-mono), monospace"
              fill="#6b7480"
            >
              P
            </text>
            <text
              x={bay.x}
              y={bay.y + 4}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-geist-mono), monospace"
              fontWeight={700}
              fill={isActive ? "#14181c" : "#d8d0c4"}
            >
              {bay.label}
            </text>
          </g>
        );
      })}

      {hover ? <MapTooltip hover={hover} /> : null}
    </svg>
  );
}
