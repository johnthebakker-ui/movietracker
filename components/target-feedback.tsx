import { Star } from "lucide-react";
import { rateTarget } from "@/app/actions/library";
import { ReviewComposer } from "@/components/review-composer";
import { ReviewCard } from "@/components/review-card";
import type { ExternalRating } from "@/lib/external-ratings";

type Review = { id: string; title: string | null; body: string; contains_spoilers: boolean; created_at: string; profiles?: { username?: string; display_name?: string | null } | null; ratings?: { score?: number | string } | { score?: number | string }[] | null };
type Props = { targetType: "season" | "episode"; targetId: number; path: string; signedIn: boolean; rating?: number | null; userRating?: number | null; reviews: Review[]; sources?: ExternalRating[] };

export function TargetRatingBar({ targetType, targetId, path, signedIn, rating, userRating, sources = [] }: Omit<Props, "reviews">) {
  return <section className="target-rating-strip">
    <div className="target-rating-sources">
      <div><span className="eyebrow">MovieTracker community</span><strong><Star size={18} fill="currentColor" /> {rating ? Number(rating).toFixed(1) : "—"}<small>/ 10</small></strong></div>
      {sources.map(source => <div key={source.source}><span className="eyebrow">{source.source}</span><strong>{source.value}</strong></div>)}
    </div>
    {signedIn ? <details className="rating-picker target-rating-picker">
      <summary><Star size={20} fill={userRating ? "currentColor" : "none"} /><span><small>Your rating</small><strong>{userRating ? `${Number(userRating).toFixed(1)} / 10` : `Rate this ${targetType}`}</strong></span></summary>
      <div className="rating-popover"><div><span>Choose your score</span><small>Use any tenth from 1.0 to 10.0.</small></div><form className="rating-number-form" action={rateTarget}><input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} /><input type="hidden" name="path" value={path} /><input className="input" type="number" name="score" min="1" max="10" step="0.1" inputMode="decimal" required defaultValue={userRating ? Number(userRating).toFixed(1) : ""} placeholder="1.0–10.0" /><button className="button accent">Save</button></form></div>
    </details> : <span className="muted">Sign in to rate</span>}
  </section>;
}

export function TargetReviewSections({ targetType, targetId, path, signedIn, userRating, reviews }: Omit<Props, "rating" | "sources">) {
  return <>{signedIn && <section className="section compact-section review-section"><div className="section-head"><div><div className="eyebrow">Your take</div><h2 className="display">Review this {targetType}</h2></div><p>Your review uses the same rating shown above.</p></div><ReviewComposer targetType={targetType} targetId={targetId} path={path} currentRating={userRating} /></section>}{reviews.length > 0 && <section className="section compact-section"><div className="section-head"><div><div className="eyebrow">Viewer notes</div><h2 className="display">Reviews</h2></div></div><div className="review-grid">{reviews.map(review => <ReviewCard review={review} key={review.id} />)}</div></section>}</>;
}

export function TargetFeedback(props: Props) { return <><TargetRatingBar {...props} /><TargetReviewSections {...props} /></>; }
