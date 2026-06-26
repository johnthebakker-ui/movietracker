import type { Genre, MediaSummary } from "@/lib/types";

export const ANIME_EXCLUDE_KEY = "anime";
export const ANIMATION_GENRE_ID = 16;

export const genreSplitNames: Record<string, string[]> = {
  "Action & Adventure": ["Action", "Adventure"],
  "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
  "Science Fiction": ["Science Fiction"],
  "Sci-Fi": ["Science Fiction"]
};

export function parseExcludedGenres(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return [...new Set(raw.split(",").map(part => part.trim()).filter(Boolean))];
}

export function isAnimeLike(item: Pick<MediaSummary, "kind" | "genres" | "originalLanguage" | "originCountries"> | any) {
  const genres = item?.genres ?? [];
  const countries = item?.originCountries ?? item?.origin_countries ?? [];
  const language = item?.originalLanguage ?? item?.original_language;
  const animated = genres.some((genre: Genre | any) => Number(genre?.id) === ANIMATION_GENRE_ID);
  return animated && (language === "ja" || countries.includes("JP"));
}

export function matchesExcludedGenre(item: Pick<MediaSummary, "genres" | "originalLanguage" | "originCountries"> | any, excluded: string[]) {
  if (!excluded.length) return false;
  const genres = item?.genres ?? [];
  const genreIds = new Set(genres.map((genre: Genre | any) => String(genre?.id)));
  const anime = isAnimeLike(item);
  return excluded.some(value => {
    if (value === ANIME_EXCLUDE_KEY) return anime;
    if (value === String(ANIMATION_GENRE_ID)) return genreIds.has(String(ANIMATION_GENRE_ID)) && !anime;
    return genreIds.has(value);
  });
}

export function normalizeGenreNamesForStats(item: Pick<MediaSummary, "genres" | "originalLanguage" | "originCountries"> | any) {
  const names = new Set<string>();
  const anime = isAnimeLike(item);
  for (const genre of item?.genres ?? []) {
    const name = typeof genre === "string" ? genre : genre?.name;
    const id = typeof genre === "object" ? Number(genre?.id) : null;
    if (!name) continue;
    if (id === ANIMATION_GENRE_ID && anime) {
      names.add("Anime");
      continue;
    }
    for (const split of genreSplitNames[name] ?? [name]) names.add(split);
  }
  return [...names];
}
