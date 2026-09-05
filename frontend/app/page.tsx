import { AboutNote } from "@/components/shared/About";
import { CircuitModelPreview } from "@/components/hero/CircuitModelPreview";
import { CircuitMotionPreview } from "@/components/hero/CircuitMotionPreview";
import { LandingHero } from "@/components/hero/LandingHero";

export default function HomePage() {
  return (
    <main className="relative">
      <LandingHero />
      <CircuitMotionPreview />
      <CircuitModelPreview />
      <div className="relative z-20 mx-auto max-w-md px-4 pb-10">
        <AboutNote />
      </div>
    </main>
  );
}
