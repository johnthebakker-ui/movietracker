"use client";

import { Ban, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { MediaKind } from "@/lib/types";

export function RecommendationInterestButton({ kind, tmdbId, initialDismissed = false, onChange, compact = false, danger = false, confirmTitle }: { kind: MediaKind; tmdbId: number; initialDismissed?: boolean; onChange?: (dismissed: boolean) => void; compact?: boolean; danger?: boolean; confirmTitle?: string }) {
  const [dismissed, setDismissed] = useState(initialDismissed); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const update = async () => {
    if (!dismissed && confirmTitle && !window.confirm(`Stop recommending ${confirmTitle}? You can undo this from its title page.`)) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/recommendations/interest", { method: dismissed ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, tmdbId }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not update your recommendations");
      setDismissed(result.dismissed); onChange?.(result.dismissed);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update your recommendations"); }
    finally { setPending(false); }
  };
  return <div className={`recommendation-interest${compact ? " compact" : ""}${danger ? " danger" : ""}`}><button type="button" className={compact ? "recommendation-dismiss" : "button ghost"} onClick={update} disabled={pending} aria-pressed={dismissed}>{dismissed ? <RotateCcw size={15} /> : <Ban size={15} />}{pending ? "Saving…" : dismissed ? "Undo not interested" : "Not interested"}</button>{error && <small role="status">{error}</small>}</div>;
}
