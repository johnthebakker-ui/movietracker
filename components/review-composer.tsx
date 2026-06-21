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
    <div className="review-composer-top"><div><span className="eyebrow">Your score</span><strong>{score !== null && Number.isFinite(score) ? <><Star size={19} fill="currentColor" /> {score.toFixed(1)}<small>/10</small></> : "Review without a rating"}</strong></div><button type="button" className="rating-clear" onClick={() => setScore(null)}>Clear rating</button></div>
    <div className="review-score-controls"><input type="range" min="1" max="10" step="0.1" value={score ?? 5.5} onChange={event => setScore(Number(event.target.value))} aria-label="Rating slider" /><label><span>Exact score</span><input className="input" type="number" min="1" max="10" step="0.1" inputMode="decimal" value={score ?? ""} onChange={event => setScore(event.target.value === "" ? null : Number(event.target.value))} placeholder="1.0–10.0" /></label></div>
    <div className="review-score-picker" role="group" aria-label="Quick review rating">{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <button type="button" className={score === value ? "active" : ""} aria-pressed={score === value} onClick={() => setScore(value)} key={value}><span>{value.toFixed(1)}</span></button>)}</div>
    <input className="review-title-input" name="title" maxLength={120} placeholder="Give your review a title (optional)" aria-label="Review title" />
    <textarea className="review-body-input" name="body" required maxLength={10000} placeholder="What worked, what didn’t, and what stayed with you?" aria-label="Review" />
    <div className="review-composer-footer"><label className="spoiler-switch"><input type="checkbox" name="spoilers" /><span><EyeOff size={15} /></span><div><strong>Contains spoilers</strong><small>Hide the text until readers choose to reveal it.</small></div></label><button className="button accent"><Send size={15} /> Publish review</button></div>
  </form>;
}
