import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { MediaDetail, SeasonDetail } from "@/lib/types";
import type { MediaSummary } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fromDbMedia } from "@/lib/db-mappers";
import { searchMedia } from "@/lib/tmdb";

export async function searchCatalog(query: string): Promise<MediaSummary[]> {
  const supabase = await createSupabaseServerClient();
  const local = supabase ? (await supabase.from("media").select("*").ilike("title", `%${query.replace(/[%_]/g, "")}%`).is("deleted_at", null).order("popularity", { ascending:false }).limit(20)).data ?? [] : [];
  const mapped: MediaSummary[] = local.map(fromDbMedia);
  if (mapped.length >= 12) return mapped;
  const remote = await searchMedia(query);
  const keys = new Set(mapped.map(x => `${x.kind}-${x.id}`));
  return [...mapped, ...remote.filter(x => !keys.has(`${x.kind}-${x.id}`))].slice(0, 24);
}

export async function ensureMedia(detail: MediaDetail) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const raw = detail.raw as any;
  const payload = {
    tmdb_id: detail.id,
    kind: detail.kind,
    title: detail.title,
    original_title: detail.originalTitle,
    overview: detail.overview,
    tagline: detail.tagline,
    poster_path: detail.posterPath,
    backdrop_path: detail.backdropPath,
    release_date: detail.releaseDate || null,
    runtime: detail.runtime,
    status: detail.status,
    original_language: detail.originalLanguage,
    origin_countries: detail.countries,
    genres: detail.genres,
    keywords: raw.keywords?.keywords ?? raw.keywords?.results ?? [],
    credits: { cast: detail.cast, crew: detail.crew },
    companies: detail.companies,
    videos: detail.videos,
    providers: raw["watch/providers"]?.results ?? {},
    external_ids: raw.external_ids ?? {},
    vote_average: detail.voteAverage,
    vote_count: detail.voteCount,
    popularity: detail.popularity,
    number_of_seasons: detail.numberOfSeasons,
    number_of_episodes: detail.numberOfEpisodes,
    raw,
    synced_at: new Date().toISOString(),
    deleted_at: null
  };
  const { data, error } = await admin.from("media").upsert(payload, { onConflict: "tmdb_id,kind" }).select("id").single();
  if (error) throw error;
  if (detail.seasons.length) {
    await admin.from("seasons").upsert(detail.seasons.map((season) => ({
      media_id: data.id, tmdb_id: season.id, season_number: season.seasonNumber, name: season.name,
      overview: season.overview, poster_path: season.posterPath, air_date: season.airDate || null,
      episode_count: season.episodeCount, synced_at: new Date().toISOString()
    })), { onConflict: "media_id,season_number" });
  }
  return data.id as number;
}

export async function ensureSeason(mediaId: number, detail: SeasonDetail) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("seasons").upsert({
    media_id: mediaId, tmdb_id: detail.id, season_number: detail.seasonNumber, name: detail.name,
    overview: detail.overview, poster_path: detail.posterPath, air_date: detail.airDate || null,
    episode_count: detail.episodeCount, synced_at: new Date().toISOString()
  }, { onConflict: "media_id,season_number" }).select("id").single();
  if (error) throw error;
  if (detail.episodes.length) {
    await admin.from("episodes").upsert(detail.episodes.map((ep) => ({
      season_id: data.id, tmdb_id: ep.id, episode_number: ep.episodeNumber, name: ep.name,
      overview: ep.overview, still_path: ep.stillPath, air_date: ep.airDate || null,
      runtime: ep.runtime, vote_average: ep.voteAverage, synced_at: new Date().toISOString()
    })), { onConflict: "season_id,episode_number" });
  }
  return data.id as number;
}
