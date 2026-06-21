import { Star } from "lucide-react";
import Link from "next/link";
import { rateTitle } from "@/app/actions/library";

export function TitleRatingPicker({ mediaId, path, rating, signedIn }: { mediaId: number | null; path: string; rating?: number | null; signedIn: boolean }) {
  if (!mediaId || !signedIn) return <Link className="rating-picker signed-out" href="/login"><Star size={18} /><span><small>Your rating</small><strong>Sign in to rate</strong></span></Link>;
  return <details className="rating-picker">
    <summary><Star size={20} fill={rating ? "currentColor" : "none"} /><span><small>Your rating</small><strong>{rating ? `${Number(rating).toFixed(1)} / 5` : "Rate this title"}</strong></span></summary>
    <div className="rating-popover"><div><span>Choose your score</span><small>Half stars are welcome.</small></div><div className="rating-score-grid">{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map(score => <form action={rateTitle} key={score}><input type="hidden" name="mediaId" value={mediaId} /><input type="hidden" name="path" value={path} /><input type="hidden" name="score" value={score} /><button className={Number(rating) === score ? "active" : ""}><Star size={13} fill="currentColor" /> {score.toFixed(1)}</button></form>)}</div></div>
  </details>;
}
