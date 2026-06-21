import { env } from "@/lib/env";

export type ExternalRating = { source: string; value: string };
export type OmdbEpisodeRating = { episode: number; title: string; released?: string; imdbRating: number | null; imdbId?: string };

export async function getExternalRatings(imdbId?: string | null): Promise<ExternalRating[]> {
  if (!env.omdbKey || !imdbId) return [];
  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", env.omdbKey);
    url.searchParams.set("i", imdbId);
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) return [];
    const data = await response.json() as { Response?: string; Ratings?: { Source: string; Value: string }[]; Metascore?: string };
    if (data.Response === "False") return [];
    return (data.Ratings ?? []).map(rating => ({ source: rating.Source === "Internet Movie Database" ? "IMDb" : rating.Source, value: rating.Value }));
  } catch { return []; }
}

export async function getOmdbSeasonRatings(imdbId?: string | null, seasonNumber?: number): Promise<OmdbEpisodeRating[]> {
  if (!env.omdbKey || !imdbId || !seasonNumber) return [];
  try { const url = new URL("https://www.omdbapi.com/"); url.searchParams.set("apikey", env.omdbKey); url.searchParams.set("i", imdbId); url.searchParams.set("Season", String(seasonNumber)); const response = await fetch(url, { next: { revalidate: 86400 } }); if (!response.ok) return []; const data = await response.json() as { Response?: string; Episodes?: { Episode: string; Title: string; Released?: string; imdbRating?: string; imdbID?: string }[] }; if (data.Response === "False") return []; return (data.Episodes ?? []).map(episode => ({ episode: Number(episode.Episode), title: episode.Title, released: episode.Released, imdbRating: episode.imdbRating && episode.imdbRating !== "N/A" ? Number(episode.imdbRating) : null, imdbId: episode.imdbID })); } catch { return []; }
}
