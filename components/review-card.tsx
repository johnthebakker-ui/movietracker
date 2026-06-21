import { MessageSquareText, Star } from "lucide-react";

type Review = { id: string; title?: string | null; body: string; contains_spoilers: boolean; created_at: string; profiles?: { username?: string; display_name?: string | null } | { username?: string; display_name?: string | null }[] | null; ratings?: { score?: number | string } | { score?: number | string }[] | null };

export function ReviewCard({ review }: { review: Review }) {
  const profile = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles;
  const rating = Array.isArray(review.ratings) ? review.ratings[0] : review.ratings;
  return <article className="review-card"><header><div className="reviewer-mark">{(profile?.display_name || profile?.username || "V").slice(0, 1).toUpperCase()}</div><div><strong>{profile?.display_name || profile?.username || "Viewer"}</strong><span>@{profile?.username || "viewer"} · {new Date(review.created_at).toLocaleDateString()}</span></div>{rating?.score && <div className="review-score"><Star size={14} fill="currentColor" /><strong>{Number(rating.score).toFixed(1)}</strong><span>/10</span></div>}</header><div className="review-card-body"><MessageSquareText size={17} />{review.title && <h3>{review.title}</h3>}{review.contains_spoilers ? <details><summary>Review contains spoilers — reveal</summary><p>{review.body}</p></details> : <p>{review.body}</p>}</div></article>;
}
