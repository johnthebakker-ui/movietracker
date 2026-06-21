"use client";
import { useEffect } from "react";

export function TraktAutoSync() {
  useEffect(() => { const sync = () => { const last = Number(sessionStorage.getItem("movietracker-trakt-sync") ?? 0); if (Date.now() - last < 4 * 60_000) return; sessionStorage.setItem("movietracker-trakt-sync", String(Date.now())); fetch("/api/integrations/trakt/sync", { method: "POST" }).catch(() => undefined); }; const timer = window.setTimeout(sync, 1800); const interval = window.setInterval(sync, 5 * 60_000); const focus = () => sync(); const visible = () => { if (document.visibilityState === "visible") sync(); }; window.addEventListener("focus", focus); document.addEventListener("visibilitychange", visible); return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); }; }, []);
  return null;
}
