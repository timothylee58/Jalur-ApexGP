interface DriverAvatarProps {
  initials: string;
  active?: boolean;
  size?: "sm" | "lg";
}

// Initials-only, no photo — matches docs/BRAND.md's "no driver photos, no
// driver imagery" rule. Decorative: the driver's name is the accessible
// label, so this is aria-hidden wherever it sits next to that name.
export function DriverAvatar({ initials, active = false, size = "sm" }: DriverAvatarProps) {
  const dimensions = size === "lg" ? "h-16 w-16 text-lg" : "h-9 w-9 text-xs";

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border font-mono font-medium uppercase tracking-wide ${dimensions} ${
        active
          ? "border-amber bg-amber/10 text-amber"
          : "border-paper/15 bg-asphalt-line/60 text-paper-dim"
      }`}
    >
      {initials}
    </span>
  );
}
