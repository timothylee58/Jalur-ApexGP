"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { circuitPath } from "@/data/sepangCircuit";

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

interface Landmark {
  id: string;
  label: string;
  x: number;
  y: number;
  description: string;
}

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
    description: "Race-weekend pass pickup, and paddock & pit access — the north gate above the pit straight.",
  },
  {
    id: "motorsport-park",
    label: "SIC Motorsport Park",
    x: 760,
    y: 200,
    description: "Multi-use motorsport facility on the circuit grounds, separate from the Grand Prix track.",
  },
  {
    id: "driving-experience",
    label: "Driving Experience Centre",
    x: 480,
    y: 195,
    description: "Guided and self-drive experience circuit for visitors.",
  },
  {
    id: "go-kart",
    label: "Go Kart",
    x: 355,
    y: 275,
    description: "Public go-kart track on the SIC grounds.",
  },
  {
    id: "paddock-pit",
    label: "Paddock / Pit Building",
    x: 700,
    y: 430,
    description: "Team garages and pit lane — the infield building the main straight runs past.",
  },
  {
    id: "south-paddock",
    label: "South Paddock",
    x: 745,
    y: 545,
    description: "Secondary paddock area south of the pit building.",
  },
  {
    id: "mall-welcome",
    label: "Welcome Centre & Mall Area",
    x: 545,
    y: 470,
    description: "Visitor welcome centre and retail area behind the Main Grandstand.",
  },
  {
    id: "helipad",
    label: "Helipad",
    x: 210,
    y: 480,
    description: "Helicopter landing pad on the west side of the circuit grounds.",
  },
  {
    id: "bus",
    label: "Bus",
    x: 225,
    y: 530,
    description: "Bus set-down and parking.",
  },
  {
    id: "taxi",
    label: "Taxi",
    x: 250,
    y: 400,
    description: "Taxi rank.",
  },
  {
    id: "petronas",
    label: "Petronas Station",
    x: 95,
    y: 490,
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

export function GeneralCircuitMap({ stands, onSelectStand, className }: GeneralCircuitMapProps) {
  const titleId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);

  const activate = (id: string) => setActiveId(id);
  const deactivate = (id: string) => setActiveId((current) => (current === id ? null : current));
  const toggle = (id: string) => setActiveId((current) => (current === id ? null : id));
  const onKeyActivate = (onActivate: () => void) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };

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

  return (
    <svg viewBox={GENERAL_MAP_VIEW_BOX} className={className} aria-labelledby={titleId}>
      <title id={titleId}>
        Sepang International Circuit general map — grandstands, facilities, and parking
      </title>
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#14181c" />

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
        <path d={circuitPath} fill="none" stroke="#3a4048" strokeWidth={26} strokeLinejoin="round" />
        <path
          d={circuitPath}
          fill="none"
          stroke="#5b636d"
          strokeWidth={2}
          strokeDasharray="2 12"
          strokeLinecap="round"
        />

        {stands.map((stand) => {
          const isActive = activeId === stand.id;
          const color = stand.selected ? "#f5a623" : "#a39b8f";
          const size = stand.selected ? 20 : 14;
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
              style={{ cursor: "pointer" }}
            >
              {stand.selected || isActive ? (
                <circle cx={stand.x} cy={stand.y} r={34} fill="#f5a623" opacity={0.15} />
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
                  strokeWidth={2}
                />
              ) : (
                <polygon
                  points={`${stand.x},${stand.y - size * 0.6} ${stand.x - size * 0.55},${stand.y + size * 0.5} ${stand.x + size * 0.55},${stand.y + size * 0.5}`}
                  fill={stand.selected ? "#f5a623" : "#14181c"}
                  stroke={color}
                  strokeWidth={2}
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
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={lm.x}
              cy={lm.y}
              r={isActive ? 7 : 5}
              fill={isActive ? "#f5a623" : "#5b636d"}
              stroke="#a39b8f"
              strokeWidth={1.5}
            />
            <text
              x={lm.x}
              y={lm.y - 12}
              textAnchor="middle"
              fontSize={12}
              fontFamily="var(--font-geist-mono), monospace"
              fill={isActive ? "#f5a623" : "#a39b8f"}
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
            style={{ cursor: "pointer" }}
          >
            <rect
              x={bay.x - 12}
              y={bay.y - 12}
              width={24}
              height={24}
              rx={4}
              fill={isActive ? "#f5a623" : "#14181c"}
              stroke={isActive ? "#f5a623" : "#5b636d"}
              strokeWidth={1.5}
            />
            <text
              x={bay.x}
              y={bay.y + 4}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-geist-mono), monospace"
              fontWeight={700}
              fill={isActive ? "#14181c" : "#a39b8f"}
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
