"use client";

import { EyeOff, Send } from "lucide-react";
import { useState } from "react";
import { writeReview, writeTargetReview } from "@/app/actions/library";

type ExistingReview = {
  title?: string | null;
  body?: string | null;
  contains_spoilers?: boolean | null;
  ratings?: { score?: number | string | null } | { score?: number | string | null }[] | null;
};

type Props = {
  targetType: "media" | "season" | "episode";
  targetId: number;
  path: string;
  currentRating?: number | null;
  existingReview?: ExistingReview | null;
};

function scoreFromReview(review?: ExistingReview | null) {
  const rating = Array.isArray(review?.ratings) ? review?.ratings[0] : review?.ratings;
  const score = Number(rating?.score);
  return Number.isFinite(score) ? score : null;
}

export function ReviewComposer({ targetType, targetId, path, currentRating, existingReview }: Props) {
  const initialScore = currentRating ? Number(currentRating) : scoreFromReview(existingReview);
  const [score, setScore] = useState<number | null>(initialScore);
  const action = targetType === "media" ? writeReview : writeTargetReview;

  return <form className="review-composer" action={action}>
    {targetType === "media" ? <input type="hidden" name="mediaId" value={targetId} /> : <><input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} /></>}
    <input type="hidden" name="path" value={path} />
    <input type="hidden" name="score" value={score ?? ""} />
    <div className="review-composer-top">
      <div><span className="eyebrow">Your score</span><strong>{score !== null && Number.isFinite(score) ? <>{score.toFixed(1)}<small>/10</small></> : "Review without a rating"}</strong></div>
      <button type="button" className="rating-clear" onClick={() => setScore(null)}>Clear rating</button>
    </div>
    <div className="review-score-slider">
      <input type="range" min="1" max="10" step="0.1" value={score ?? 5.5} onChange={event => setScore(Number(event.target.value))} aria-label="Review rating from 1 to 10" />
      <div><span>1.0</span><span>5.5</span><span>10.0</span></div>
    </div>
    <input className="review-title-input" name="title" maxLength={120} placeholder="Give your review a title (optional)" aria-label="Review title" defaultValue={existingReview?.title ?? ""} />
    <textarea className="review-body-input" name="body" required maxLength={10000} placeholder="What worked, what didn't, and what stayed with you?" aria-label="Review" defaultValue={existingReview?.body ?? ""} />
    <div className="review-composer-footer">
      <label className="spoiler-switch"><input type="checkbox" name="spoilers" defaultChecked={Boolean(existingReview?.contains_spoilers)} /><span><EyeOff size={15} /></span><div><strong>Contains spoilers</strong><small>Hide the text until readers choose to reveal it.</small></div></label>
      <button className="button accent"><Send size={15} /> {existingReview ? "Update review" : "Publish review"}</button>
    </div>
  </form>;
}
