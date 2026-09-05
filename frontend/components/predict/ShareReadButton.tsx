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

  function openCard() {
    // Same params as the share link, rendered as an image via the /og route.
    const shareUrl = buildShareUrl(data, window.location.origin);
    window.open(shareUrl.replace("/predict?", "/og?"), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="flex-1 rounded-full border border-paper/20 py-2 font-mono text-[11px] uppercase tracking-wide text-paper-dim hover:border-amber hover:text-amber"
      >
        {copied ? "Link copied" : "Share this read"}
      </button>
      <button
        type="button"
        onClick={openCard}
        className="rounded-full border border-paper/20 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-paper-dim hover:border-amber hover:text-amber"
      >
        Card
      </button>
    </div>
  );
}
