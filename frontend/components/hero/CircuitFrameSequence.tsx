import { ScrollFrameSequence } from "@/components/shared/ScrollFrameSequence";

const FRAME_COUNT = 48;

export function CircuitFrameSequence() {
  return (
    <ScrollFrameSequence
      framesPath="/circuit-frames"
      frameCount={FRAME_COUNT}
      className="pointer-events-none absolute inset-0 z-0 opacity-90"
    />
  );
}
