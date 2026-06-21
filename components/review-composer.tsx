"use client";

import { EyeOff, Send, Star } from "lucide-react";
import { useState } from "react";
import { writeReview, writeTargetReview } from "@/app/actions/library";

type Props = { targetType: "media" | "season" | "episode"; targetId: number; path: string; currentRating?: number | null };

export function ReviewComposer({ targetType, targetId, path, currentRating }: Props) {
  const [score, setScore] = useState<number | null>(currentRating ? Number(currentRating) : null);
  const action = targetType === "media" ? writeReview : writeTargetReview;
  return <form className="review-composer" action={action}>
    {targetType === "media" ? <input type="hidden" name="mediaId" value={targetId} /> : <><input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} /></>}
    <input type="hidden" name="path" value={path} /><input type="hidden" name="score" value={score ?? ""} />
    <div className="review-composer-top"><div><span className="eyebrow">Your score</span><strong>{score ? <><Star size={19} fill="currentColor" /> {score.toFixed(1)}<small>/5</small></> : "Review without a rating"}</strong></div><button type="button" className="rating-clear" onClick={() => setScore(null)}>Clear rating</button></div>
    <div className="review-score-picker" role="group" aria-label="Review rating">{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map(value => <button type="button" className={score === value ? "active" : ""} aria-pressed={score === value} onClick={() => setScore(value)} key={value}><Star size={13} fill="currentColor" /><span>{value.toFixed(1)}</span></button>)}</div>
    <input className="review-title-input" name="title" maxLength={120} placeholder="Give your review a title (optional)" aria-label="Review title" />
    <textarea className="review-body-input" name="body" required maxLength={10000} placeholder="What worked, what didn’t, and what stayed with you?" aria-label="Review" />
    <div className="review-composer-footer"><label className="spoiler-switch"><input type="checkbox" name="spoilers" /><span><EyeOff size={15} /></span><div><strong>Contains spoilers</strong><small>Hide the text until readers choose to reveal it.</small></div></label><button className="button accent"><Send size={15} /> Publish review</button></div>
  </form>;
}
