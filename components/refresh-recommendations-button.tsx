"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

export function RefreshRecommendationsButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations/refresh", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not refresh recommendations");
      window.location.reload();
    } catch (reason) {
      setPending(false);
      setError(reason instanceof Error ? reason.message : "Could not refresh recommendations");
    }
  };

  return <div className="refresh-recommendations">
    <button className="button ghost" type="button" onClick={refresh} disabled={pending}>
      <RefreshCw className={pending ? "spin" : ""} size={16} />
      {pending ? "Finding fresh picks..." : "Refresh picks"}
    </button>
    {error && <small role="status">{error}</small>}
  </div>;
}
