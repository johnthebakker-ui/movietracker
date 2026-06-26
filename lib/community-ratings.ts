import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MediaSummary } from "@/lib/types";

type RatingRow = {
  tmdb_id: number | string;
  kind: "movie" | "show";
  average_score: number | string;
  rating_count: number | string;
};

type UserRatingRow = {
  score: number | string;
  media: { tmdb_id: number | string; kind: "movie" | "show" } | { tmdb_id: number | string; kind: "movie" | "show" }[] | null;
};

export async function withCommunityRatings(items: MediaSummary[], client?: any): Promise<MediaSummary[]> {
  if (!items.length) return items;
  const supabase = client ?? await createSupabaseServerClient();
  if (!supabase) return items.map(item => ({ ...item, communityRating: null, communityRatingCount: 0, userRating: null }));

  const tmdbIds = [...new Set(items.map(item => item.id))];
  const { data, error } = await supabase.rpc("get_media_community_ratings", { p_tmdb_ids: tmdbIds });
  if (error) {
    console.error("Community rating lookup failed", error);
    return items.map(item => ({ ...item, communityRating: null, communityRatingCount: 0, userRating: null }));
  }

  const ratings = new Map(((data as RatingRow[] | null) ?? []).map(row => [
    `${row.kind}-${Number(row.tmdb_id)}`,
    { average: Number(row.average_score), count: Number(row.rating_count) }
  ]));
  const userRatings = new Map<string, number>();
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { data: rows, error: userRatingError } = await supabase
        .from("ratings")
        .select("score,media!inner(tmdb_id,kind)")
        .eq("user_id", auth.user.id)
        .in("media.tmdb_id", tmdbIds);
      if (!userRatingError) {
        ((rows as UserRatingRow[] | null) ?? []).forEach(row => {
          const media = Array.isArray(row.media) ? row.media[0] : row.media;
          if (media) userRatings.set(`${media.kind}-${Number(media.tmdb_id)}`, Number(row.score));
        });
      }
    }
  } catch (error) {
    console.error("User rating lookup failed", error);
  }
  return items.map(item => {
    const rating = ratings.get(`${item.kind}-${item.id}`);
    return { ...item, communityRating: rating?.average ?? null, communityRatingCount: rating?.count ?? 0, userRating: userRatings.get(`${item.kind}-${item.id}`) ?? null };
  });
}
