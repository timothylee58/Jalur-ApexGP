import { inkForAccent } from "@/lib/driverAccent";

interface DriverAvatarProps {
  initials: string;
  number?: number | null;
  /** Constructor accent hex (helmet shell). */
  accent?: string;
  /** Secondary trim hex. */
  accentSecondary?: string;
  active?: boolean;
  size?: "sm" | "lg";
}

/**
 * Stylized helmet badge — not a likeness or photo. Shell uses constructor
 * accent colors; race number (or initials) sits on the cheek. Decorative
 * next to the driver's accessible name.
 */
export function DriverAvatar({
  initials,
  number = null,
  accent = "#a39b8f",
  accentSecondary = "#2a3036",
  active = false,
  size = "sm",
}: DriverAvatarProps) {
  const box = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const ink = inkForAccent(accent);
  const label = number !== null ? String(number) : initials.slice(0, 2);
  const gradId = `helm-${initials}-${label}`.replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center ${box} ${
        active ? "drop-shadow-[0_0_8px_rgba(245,166,35,0.55)]" : ""
      }`}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" role="presentation">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accent} />
            <stop offset="100%" stopColor={accentSecondary} stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          d="M12 34c0-14 10-26 20-26s20 12 20 26v6c0 6-5 12-20 12S12 46 12 40v-6z"
          fill={`url(#${gradId})`}
          stroke={active ? "#f5a623" : "rgba(244,239,230,0.25)"}
          strokeWidth={active ? 2.2 : 1.2}
        />
        <path
          d="M18 30c2-8 8-14 14-14s12 6 14 14c-4 2-9 3-14 3s-10-1-14-3z"
          fill="#0a0c0e"
          opacity="0.92"
        />
        <path
          d="M22 29c2-5 6-9 10-9s8 4 10 9"
          fill="none"
          stroke="rgba(244,239,230,0.35)"
          strokeWidth="1"
        />
        <rect
          x="26"
          y="44"
          width="12"
          height="3"
          rx="1.2"
          fill={accentSecondary}
          opacity="0.9"
        />
        <text
          x="32"
          y="41"
          textAnchor="middle"
          fill={ink}
          fontSize={number !== null ? 11 : 10}
          fontFamily="ui-monospace, monospace"
          fontWeight="700"
        >
          {label}
        </text>
      </svg>
    </span>
  );
}
