import Image from "@/components/app-image";
import { MessageSquareText } from "lucide-react";

type Profile = { username?: string; display_name?: string | null; avatar_url?: string | null };
type Review = {
  id: string;
  title?: string | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
  updated_at?: string | null;
  profiles?: Profile | Profile[] | null;
  ratings?: { score?: number | string } | { score?: number | string }[] | null;
};

export function ReviewCard({ review }: { review: Review }) {
  const profile = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles;
  const rating = Array.isArray(review.ratings) ? review.ratings[0] : review.ratings;
  const name = profile?.display_name || profile?.username || "Viewer";
  const edited = review.updated_at && new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 1000;

  return <article className="review-card">
    <header>
      <div className="reviewer-mark">{profile?.avatar_url ? <Image src={profile.avatar_url} alt="" fill sizes="38px" /> : name.slice(0, 1).toUpperCase()}</div>
      <div><strong>{name}</strong><span>@{profile?.username || "viewer"} · {new Date(review.created_at).toLocaleDateString()}{edited ? " · edited" : ""}</span></div>
      {rating?.score && <div className="review-score"><strong>{Number(rating.score).toFixed(1)}</strong><span>/10</span></div>}
    </header>
    <div className="review-card-body">
      <MessageSquareText size={17} />
      {review.title && <h3>{review.title}</h3>}
      {review.contains_spoilers ? <details><summary>Review contains spoilers — reveal</summary><p>{review.body}</p></details> : <p>{review.body}</p>}
    </div>
  </article>;
}
