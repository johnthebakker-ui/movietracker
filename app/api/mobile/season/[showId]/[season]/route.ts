import { NextResponse } from "next/server";
import { getOmdbSeasonRatings } from "@/lib/external-ratings";
import { getMedia, getSeason } from "@/lib/tmdb";
import { ensureMedia, ensureSeason } from "@/lib/catalog";
import { badRequest, mapSeason, mapTargetReview, mobileAuth, ok } from "@/app/api/mobile/_lib/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ showId: string; season: string }> }) {
  const { showId: rawShowId, season: rawSeason } = await params;
  const showId = Number(rawShowId);
  const seasonNumber = Number(rawSeason);
  if (![showId, seasonNumber].every(Number.isFinite)) return badRequest("Invalid season");

  try {
    const [show, season] = await Promise.all([getMedia("show", showId), getSeason(showId, seasonNumber)]);
    let mediaId: number | null = null;
    let seasonId: number | null = null;
    try {
      mediaId = await ensureMedia(show);
      if (mediaId) seasonId = await ensureSeason(mediaId, season);
    } catch (error) {
      console.error("Mobile season hydration failed", error);
    }
    const { supabase, user } = await mobileAuth();
    const imdbRatings = await getOmdbSeasonRatings((show.raw as any).external_ids?.imdb_id, season.seasonNumber);
    const reviewSelect = "id,title,body,created_at,updated_at,user_id,rating_id,contains_spoilers,ratings(score)";
    const [ratingRows, reviewRows, myReviewRow] = supabase && seasonId ? await Promise.all([
      supabase.from("ratings").select("score,user_id").eq("season_id", seasonId),
      supabase.from("reviews").select(reviewSelect).eq("season_id", seasonId).order("created_at", { ascending: false }).limit(20),
      user ? supabase.from("reviews").select(reviewSelect).eq("user_id", user.id).eq("season_id", seasonId).maybeSingle() : Promise.resolve({ data: null })
    ]) : [{ data: [] }, { data: [] }, { data: null }];
    const ratings = ratingRows.data ?? [];
    return ok({
      show,
      mediaId,
      seasonId,
      userRating: user ? Number(ratings.find((row: any) => row.user_id === user.id)?.score ?? 0) || null : null,
      communityRating: ratings.length ? ratings.reduce((sum: number, row: any) => sum + Number(row.score), 0) / ratings.length : null,
      reviews: (reviewRows.data ?? []).map((review: any) => mapTargetReview(review, show, "season")),
      myReview: myReviewRow.data ? mapTargetReview(myReviewRow.data, show, "season") : null,
      season: mapSeason(season),
      episodes: season.episodes.map(episode => ({
        id: episode.id,
        name: episode.name,
        overview: episode.overview,
        episode_number: episode.episodeNumber,
        season_number: episode.seasonNumber,
        air_date: episode.airDate,
        still_path: episode.stillPath,
        runtime: episode.runtime,
        vote_average: episode.voteAverage,
        vote_count: episode.voteCount
      })),
      imdbRatings
    });
  } catch (error) {
    console.error("Mobile season API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Season failed" }, { status: 502 });
  }
}
