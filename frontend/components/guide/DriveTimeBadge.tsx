interface DriveTimeBadgeProps {
  minutes: number;
}

export function DriveTimeBadge({ minutes }: DriveTimeBadgeProps) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-wide text-pit-lime">
      {minutes} min drive
    </span>
  );
}
