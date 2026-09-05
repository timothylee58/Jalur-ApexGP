import { AboutNote } from "@/components/shared/About";
import { CircuitModelPreview } from "@/components/hero/CircuitModelPreview";
import { CircuitMotionPreview } from "@/components/hero/CircuitMotionPreview";
import { LandingHero } from "@/components/hero/LandingHero";
import { WeekendHub } from "@/components/weekend/WeekendHub";

export default function HomePage() {
  return (
    <main className="relative">
      <LandingHero />
      <WeekendHub />
      <CircuitMotionPreview />
      <CircuitModelPreview />
      <div className="relative z-20 mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="max-w-xl">
          <AboutNote />
        </div>
      </div>
    </main>
  );
}
