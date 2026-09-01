"use client";

import { useState } from "react";
import type { PredictionResponse } from "@/types";
import { buildShareUrl } from "@/lib/predictionUtils";

interface ShareReadButtonProps {
  data: PredictionResponse;
}

export function ShareReadButton({ data }: ShareReadButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = buildShareUrl(data, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full rounded-full border border-paper/20 py-2 font-mono text-[11px] uppercase tracking-wide text-paper-dim hover:border-amber hover:text-amber"
    >
      {copied ? "Link copied — no account needed" : "Share this read (URL only, no DB)"}
    </button>
  );
}
