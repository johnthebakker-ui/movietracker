import { Gauge } from "lucide-react";
import { rateTarget } from "@/app/actions/library";
import { ReviewComposer } from "@/components/review-composer";
import { ReviewCard } from "@/components/review-card";
import type { ExternalRating } from "@/lib/external-ratings";

type Review = {
  id: string;
  user_id?: string | null;
  title: string | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
  updated_at?: string | null;
  profiles?: { username?: string; display_name?: string | null; avatar_url?: string | null } | null;
  ratings?: { score?: number | string } | { score?: number | string }[] | null;
};
type Props = { targetType: "season" | "episode"; targetId: number; path: string; signedIn: boolean; rating?: number | null; userRating?: number | null; reviews: Review[]; sources?: ExternalRating[]; currentUserId?: string };

export function TargetRatingBar({ targetType, targetId, path, signedIn, rating, userRating, sources = [] }: Omit<Props, "reviews" | "currentUserId">) {
  return <section className="target-rating-strip">
    <div className="target-rating-sources">
      <div><span className="eyebrow">MovieTracker community</span><strong>{rating ? Number(rating).toFixed(1) : "—"}<small>/ 10</small></strong></div>
      {sources.map(source => <div key={source.source}><span className="eyebrow">{source.source}</span><strong>{source.value}</strong></div>)}
    </div>
    {signedIn ? <details className="rating-picker target-rating-picker">
      <summary><Gauge size={20} /><span><small>Your rating</small><strong>{userRating ? `${Number(userRating).toFixed(1)} / 10` : `Rate this ${targetType}`}</strong></span></summary>
      <div className="rating-popover"><div><span>Choose your score</span><small>Use any tenth from 1.0 to 10.0.</small></div><form className="rating-number-form" action={rateTarget}><input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} /><input type="hidden" name="path" value={path} /><input className="input" type="number" name="score" min="1" max="10" step="0.1" inputMode="decimal" required defaultValue={userRating ? Number(userRating).toFixed(1) : ""} placeholder="1.0–10.0" /><button className="button accent">Save</button></form></div>
    </details> : <span className="muted">Sign in to rate</span>}
  </section>;
}

export function TargetReviewSections({ targetType, targetId, path, signedIn, userRating, reviews, currentUserId }: Omit<Props, "rating" | "sources">) {
  const existingReview = currentUserId ? reviews.find(review => review.user_id === currentUserId) : null;
  return <>
    {signedIn && <section className="section compact-section review-section"><div className="section-head"><div><div className="eyebrow">Your take</div><h2 className="display">{existingReview ? "Edit your review" : `Review this ${targetType}`}</h2></div><p>Your review uses the same rating shown above.</p></div><ReviewComposer targetType={targetType} targetId={targetId} path={path} currentRating={userRating} existingReview={existingReview} /></section>}
    {reviews.length > 0 && <section className="section compact-section"><div className="section-head"><div><div className="eyebrow">Viewer notes</div><h2 className="display">Reviews</h2></div></div><div className="review-grid">{reviews.map(review => <ReviewCard review={review} key={review.id} />)}</div></section>}
  </>;
}

export function TargetFeedback(props: Props) { return <><TargetRatingBar {...props} /><TargetReviewSections {...props} /></>; }
