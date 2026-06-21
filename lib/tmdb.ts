import { unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import type { EpisodeDetail, Genre, MediaDetail, MediaKind, MediaSummary, SeasonDetail } from "@/lib/types";

const API = "https://api.themoviedb.org/3";

async function request<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
  if (!env.tmdbToken) throw new Error("TMDB_API_TOKEN is not configured");
  const url = new URL(`${API}${path}`);
  Object.entries(params).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, String(value)));
  let lastStatus = 0; let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${env.tmdbToken}`, accept: "application/json", "user-agent": "MovieTracker/0.1" },
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(15_000)
      });
      if (response.ok) return response.json() as Promise<T>;
      lastStatus = response.status;
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) throw new Error(`TMDB request failed (${response.status})`);
    } catch (error) { lastError = error; if (error instanceof Error && error.message.startsWith("TMDB request failed")) throw error; }
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 350 * 2 ** attempt));
  }
  throw new Error(`TMDB is temporarily unavailable${lastStatus ? ` (${lastStatus})` : ""}. Please try again.`, { cause: lastError });
}

function summary(item: any, forcedKind?: MediaKind): MediaSummary {
  const kind: MediaKind = forcedKind ?? (item.media_type === "tv" || item.name ? "show" : "movie");
  const genreObjects: Genre[] = item.genres ?? (item.genre_ids ?? []).map((id: number) => ({ id, name: "" }));
  return {
    id: item.id,
    kind,
    title: item.title ?? item.name ?? "Untitled",
    overview: item.overview ?? "",
    posterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
    releaseDate: item.release_date ?? item.first_air_date ?? null,
    voteAverage: item.vote_average ?? 0,
    voteCount: item.vote_count ?? 0,
    popularity: item.popularity ?? 0,
    genres: genreObjects
  };
}

export const getTrending = unstable_cache(async (): Promise<MediaSummary[]> => {
  const data = await request<any>("/trending/all/week", { language: "en-US" });
  return data.results.filter((x: any) => x.media_type !== "person").map((x: any) => summary(x));
}, ["tmdb-trending"], { revalidate: 1800 });

export async function discover(kind: MediaKind, options: Record<string, string | undefined> = {}): Promise<{items: MediaSummary[]; page: number; totalPages: number}> {
  const pathKind = kind === "show" ? "tv" : "movie";
  const data = await request<any>(`/discover/${pathKind}`, { language: "en-US", include_adult: false, sort_by: "popularity.desc", ...options });
  return { items: data.results.map((x: any) => summary(x, kind)), page: data.page, totalPages: data.total_pages };
}

export async function searchMedia(query: string, page = 1): Promise<MediaSummary[]> {
  const data = await request<any>("/search/multi", { query, page, language: "en-US", include_adult: false });
  return data.results.filter((x: any) => x.media_type === "movie" || x.media_type === "tv").map((x: any) => summary(x));
}

export async function getMedia(kind: MediaKind, id: number): Promise<MediaDetail> {
  const pathKind = kind === "show" ? "tv" : "movie";
  const item = await request<any>(`/${pathKind}/${id}`, { append_to_response: "credits,videos,images,recommendations,watch/providers,keywords,external_ids", include_image_language: "en,null", language: "en-US" });
  const base = summary(item, kind);
  return {
    ...base,
    originalTitle: item.original_title ?? item.original_name ?? base.title,
    tagline: item.tagline ?? "",
    runtime: item.runtime ?? item.episode_run_time?.[0] ?? null,
    status: item.status ?? "",
    originalLanguage: item.original_language ?? "",
    countries: (item.production_countries ?? item.origin_country ?? []).map((x: any) => x.iso_3166_1 ?? x),
    cast: (item.credits?.cast ?? []).slice(0, 20),
    crew: (item.credits?.crew ?? []).filter((x: any) => ["Director", "Creator", "Executive Producer", "Writer"].includes(x.job)).slice(0, 15),
    companies: item.production_companies ?? [],
    videos: (item.videos?.results ?? []).filter((x: any) => x.site === "YouTube"),
    seasons: (item.seasons ?? []).filter((x: any) => x.season_number > 0).map((x: any) => ({
      id: x.id, seasonNumber: x.season_number, name: x.name, overview: x.overview ?? "", posterPath: x.poster_path ?? null,
      airDate: x.air_date ?? null, episodeCount: x.episode_count ?? 0
    })),
    numberOfEpisodes: item.number_of_episodes,
    numberOfSeasons: item.number_of_seasons,
    recommendations: (item.recommendations?.results ?? []).slice(0, 20).map((x: any) => summary(x, kind)),
    images: {
      backdrops: (item.images?.backdrops ?? []).slice(0, 12).map((image: any) => ({ filePath: image.file_path, width: image.width, height: image.height })),
      posters: (item.images?.posters ?? []).slice(0, 8).map((image: any) => ({ filePath: image.file_path, width: image.width, height: image.height }))
    },
    raw: item
  };
}

export async function getSeason(showId: number, seasonNumber: number): Promise<SeasonDetail> {
  const season = await request<any>(`/tv/${showId}/season/${seasonNumber}`, { language: "en-US", append_to_response: "credits,videos,images", include_image_language: "en,null" });
  return {
    id: season.id,
    seasonNumber: season.season_number,
    name: season.name,
    overview: season.overview ?? "",
    posterPath: season.poster_path ?? null,
    airDate: season.air_date ?? null,
    episodeCount: season.episodes?.length ?? 0,
    episodes: (season.episodes ?? []).map((ep: any): EpisodeDetail => ({
      id: ep.id, episodeNumber: ep.episode_number, seasonNumber: ep.season_number, name: ep.name,
      overview: ep.overview ?? "", stillPath: ep.still_path ?? null, airDate: ep.air_date ?? null,
      runtime: ep.runtime ?? null, voteAverage: ep.vote_average ?? 0, voteCount: ep.vote_count ?? 0
    })),
    videos: (season.videos?.results ?? []).filter((video: any) => video.site === "YouTube"),
    images: { posters: (season.images?.posters ?? []).slice(0, 10).map((image: any) => ({ filePath: image.file_path, width: image.width, height: image.height })) },
    cast: (season.credits?.cast ?? []).slice(0, 20)
  };
}

export async function getEpisode(showId: number, seasonNumber: number, episodeNumber: number): Promise<EpisodeDetail> {
  const episode = await request<any>(`/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`, { language: "en-US", append_to_response: "credits,videos,images,external_ids", include_image_language: "en,null" });
  return {
    id: episode.id,
    episodeNumber: episode.episode_number,
    seasonNumber: episode.season_number,
    name: episode.name,
    overview: episode.overview ?? "",
    stillPath: episode.still_path ?? null,
    airDate: episode.air_date ?? null,
    runtime: episode.runtime ?? null,
    voteAverage: episode.vote_average ?? 0,
    voteCount: episode.vote_count ?? 0,
    videos: (episode.videos?.results ?? []).filter((video: any) => video.site === "YouTube"),
    images: (episode.images?.stills ?? []).slice(0, 12).map((image: any) => ({ filePath: image.file_path, width: image.width, height: image.height })),
    cast: [...(episode.credits?.cast ?? []), ...(episode.credits?.guest_stars ?? [])].slice(0, 20),
    crew: (episode.credits?.crew ?? []).slice(0, 20)
    ,externalIds: episode.external_ids ?? {}
  };
}

export async function getGenres(kind?: MediaKind) {
  if (kind) {
    const data = await request<any>(`/genre/${kind === "show" ? "tv" : "movie"}/list`, { language: "en" });
    return (data.genres as Genre[]).sort((a, b) => a.name.localeCompare(b.name));
  }
  const [movies, shows] = await Promise.all([request<any>("/genre/movie/list", { language: "en" }), request<any>("/genre/tv/list", { language: "en" })]);
  return Array.from(new Map([...movies.genres, ...shows.genres].map((g: Genre) => [g.id, g])).values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPerson(id: number) {
  const person = await request<any>(`/person/${id}`, { append_to_response: "combined_credits,images,external_ids", language: "en-US" });
  const credits: MediaSummary[] = (person.combined_credits?.cast ?? []).filter((item: any) => item.media_type === "movie" || item.media_type === "tv").map((item: any) => summary(item));
  return { id: person.id, name: person.name, biography: person.biography ?? "", birthday: person.birthday, deathday: person.deathday, placeOfBirth: person.place_of_birth, profilePath: person.profile_path, knownFor: person.known_for_department, credits: Array.from(new Map(credits.map(item => [`${item.kind}-${item.id}`, item])).values()).sort((a, b) => b.popularity - a.popularity), images: (person.images?.profiles ?? []).map((image: any) => image.file_path as string) };
}

export async function getCompany(id: number, year?: string) {
  const company = await request<any>(`/company/${id}`);
  const validYear = /^\d{4}$/.test(year ?? "") ? year : undefined;
  const [movies, shows] = await Promise.all([discover("movie", { with_companies: String(id), sort_by: "popularity.desc", primary_release_date: undefined, ...(validYear ? { "primary_release_date.gte": `${validYear}-01-01`, "primary_release_date.lte": `${validYear}-12-31` } : {}) }), discover("show", { with_companies: String(id), sort_by: "popularity.desc", ...(validYear ? { "first_air_date.gte": `${validYear}-01-01`, "first_air_date.lte": `${validYear}-12-31` } : {}) })]);
  return { id: company.id, name: company.name, description: company.description ?? "", headquarters: company.headquarters, homepage: company.homepage, originCountry: company.origin_country, logoPath: company.logo_path, parentCompany: company.parent_company, movies, shows };
}

export const imageUrl = (path: string | null | undefined, size = "w500") => path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
