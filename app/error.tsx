"use client";
import { RefreshCw, WifiOff } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const upstream = error.message.includes("TMDB") || error.message.includes("temporarily unavailable");
  return <main className="page"><div className="shell"><div className="route-error"><WifiOff size={30} /><div className="eyebrow">{upstream ? "The catalog service blinked" : "Something went off script"}</div><h1 className="display">{upstream ? "This page needs another take." : "We couldn’t load this page."}</h1><p className="muted">{upstream ? "TMDB occasionally returns a temporary gateway error. MovieTracker retried automatically; try once more in a moment." : error.message}</p><button className="button accent" onClick={reset}><RefreshCw size={16} /> Try again</button></div></div></main>;
}
