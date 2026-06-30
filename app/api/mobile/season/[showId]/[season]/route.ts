import { NextResponse } from "next/server";
import { getOmdbSeasonRatings } from "@/lib/external-ratings";
import { getMedia, getSeason } from "@/lib/tmdb";
import { ensureMedia, ensureSeason } from "@/lib/catalog";
import { badRequest, mapSeason, mobileAuth, ok } from "@/app/api/mobile/_lib/catalog";

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
    await mobileAuth();
    const imdbRatings = await getOmdbSeasonRatings((show.raw as any).external_ids?.imdb_id, season.seasonNumber);
    return ok({
      show,
      mediaId,
      seasonId,
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
