import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-bleed sticky-section copy stack.
 * Pins to the bottom over the image; scrolls inside the sticky pane on
 * short/landscape heights. Safe-area aware for notched devices.
 */
export function HeroOverlay({
  children,
  className,
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  /** "center" horizontally-centers the copy stack (text-align included) —
   * used by LandingHero's redesigned centered header. Defaults to the
   * original left-aligned layout so other consumers (CircuitMotionPreview)
   * are unaffected. */
  align?: "start" | "center";
}) {
  return (
    <div
      className={cn(
        "relative z-10 h-full min-h-0 w-full overflow-y-auto overscroll-contain",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex min-h-full w-full max-w-5xl flex-col justify-end",
          "px-5 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] pt-[max(1rem,env(safe-area-inset-top))]",
          "sm:px-6 sm:pb-14 sm:pt-10",
          "md:pb-20 md:pt-16",
          // Short / landscape: top-align so nothing clips off the chin.
          "[@media(max-height:640px)]:justify-start [@media(max-height:640px)]:py-4",
          align === "center" && "items-center text-center"
        )}
      >
        {children}
      </div>
    </div>
  );
}
