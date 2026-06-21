import { Star } from "lucide-react";
import Link from "next/link";
import { rateTitle } from "@/app/actions/library";

export function TitleRatingPicker({ mediaId, path, rating, signedIn }: { mediaId: number | null; path: string; rating?: number | null; signedIn: boolean }) {
  if (!mediaId || !signedIn) return <Link className="rating-picker signed-out" href="/login"><Star size={18} /><span><small>Your rating</small><strong>Sign in to rate</strong></span></Link>;
  return <details className="rating-picker">
    <summary><Star size={20} fill={rating ? "currentColor" : "none"} /><span><small>Your rating</small><strong>{rating ? `${Number(rating).toFixed(1)} / 10` : "Rate this title"}</strong></span></summary>
    <div className="rating-popover"><div><span>Choose your score</span><small>Use any tenth from 1.0 to 10.0.</small></div><form className="rating-number-form" action={rateTitle}><input type="hidden" name="mediaId" value={mediaId} /><input type="hidden" name="path" value={path} /><input className="input" type="number" name="score" min="1" max="10" step="0.1" inputMode="decimal" required defaultValue={rating ? Number(rating).toFixed(1) : ""} placeholder="1.0–10.0" /><button className="button accent">Save</button></form></div>
  </details>;
}
