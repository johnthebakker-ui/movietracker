import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { redirect } from "next/navigation";
import { UserReviewList, type UserReview } from "@/components/user-review-list";
import { getServerAuth } from "@/lib/auth-server";

const reviewSelect = "id,title,body,contains_spoilers,created_at,updated_at,media(id,tmdb_id,kind,title,poster_path,backdrop_path),seasons(id,season_number,name,poster_path,media(id,tmdb_id,kind,title,poster_path,backdrop_path)),episodes(id,name,episode_number,still_path,seasons(season_number,name,media(id,tmdb_id,kind,title,poster_path,backdrop_path))),ratings(score)";

export default async function ReviewsPage() {
  const { supabase, user } = await getServerAuth();
  if (!supabase || !user) redirect("/login");
  const { data } = await supabase.from("reviews").select(reviewSelect).eq("user_id", user.id).order("updated_at", { ascending: false }).limit(500);
  const reviews = (data ?? []) as UserReview[];

  return <main className="page"><div className="shell narrow-shell">
    <div className="page-heading-row"><div><div className="eyebrow">Every take in one place</div><h1 className="display page-title">Your reviews</h1></div><Link className="button ghost" href="/library"><MessageSquareText size={16} /> Review more</Link></div>
    {reviews.length ? <UserReviewList reviews={reviews} /> : <div className="empty-state"><MessageSquareText size={28} /><h2 className="display">No reviews yet</h2><p className="muted">Write a review from any movie, show, season, or episode page and it will appear here.</p><Link className="button accent" href="/discover">Find something</Link></div>}
  </div></main>;
}
