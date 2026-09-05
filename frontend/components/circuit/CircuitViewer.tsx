"use client";

/**
 * CircuitViewer — thin 2D viewer over the shared `sepang.json` centreline
 * (via SepangCircuitMap / sepangCircuit.ts). Named entry point for the
 * Orbit Sepang pipeline: JSON → generate_circuit_models.py → sepang.glb.
 */

import { SepangCircuitMap } from "@/components/circuit/SepangCircuitMap";

export function CircuitViewer({
  className,
  highlighted = [],
  muted = false,
}: {
  className?: string;
  highlighted?: string[];
  muted?: boolean;
}) {
  return (
    <SepangCircuitMap className={className} highlighted={highlighted} muted={muted} />
  );
}

export default CircuitViewer;
