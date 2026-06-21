"use client";
import { RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";

export function TraktControls() {
  const [status, setStatus] = useState(""); const [pending, setPending] = useState(false);
  async function sync() { setPending(true); setStatus("Importing history, ratings, and watchlist…"); const response = await fetch("/api/integrations/trakt/sync?force=1", { method: "POST" }); const result = await response.json(); setPending(false); setStatus(response.ok ? `Synced: ${result.history} watches, ${result.ratings} ratings, ${result.watchlist} watchlist titles imported.` : result.error ?? "Sync failed"); }
  async function disconnect() { if (!window.confirm("Disconnect Trakt? Imported MovieTracker data will be kept.")) return; setPending(true); const response = await fetch("/api/integrations/trakt/disconnect", { method: "POST" }); if (response.ok) window.location.reload(); else { const result = await response.json(); setStatus(result.error ?? "Disconnect failed"); setPending(false); } }
  return <div className="trakt-controls"><button className="button accent" disabled={pending} onClick={sync}><RefreshCw size={16} className={pending ? "spin" : ""} /> {pending ? "Syncing…" : "Sync now"}</button><button className="button ghost" disabled={pending} onClick={disconnect}><Unplug size={16} /> Disconnect</button>{status && <p role="status" className="muted">{status}</p>}</div>;
}
