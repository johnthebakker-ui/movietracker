import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MediaSummary } from "@/lib/types";

type RatingRow = {
  tmdb_id: number | string;
  kind: "movie" | "show";
  average_score: number | string;
  rating_count: number | string;
};

export async function withCommunityRatings(items: MediaSummary[], client?: any): Promise<MediaSummary[]> {
  if (!items.length) return items;
  const supabase = client ?? await createSupabaseServerClient();
  if (!supabase) return items.map(item => ({ ...item, communityRating: null, communityRatingCount: 0 }));

  const tmdbIds = [...new Set(items.map(item => item.id))];
  const { data, error } = await supabase.rpc("get_media_community_ratings", { p_tmdb_ids: tmdbIds });
  if (error) {
    console.error("Community rating lookup failed", error);
    return items.map(item => ({ ...item, communityRating: null, communityRatingCount: 0 }));
  }

  const ratings = new Map(((data as RatingRow[] | null) ?? []).map(row => [
    `${row.kind}-${Number(row.tmdb_id)}`,
    { average: Number(row.average_score), count: Number(row.rating_count) }
  ]));
  return items.map(item => {
    const rating = ratings.get(`${item.kind}-${item.id}`);
    return { ...item, communityRating: rating?.average ?? null, communityRatingCount: rating?.count ?? 0 };
  });
}
