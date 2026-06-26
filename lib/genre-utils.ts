import type { Genre, MediaSummary } from "@/lib/types";

export const ANIME_EXCLUDE_KEY = "anime";
export const ANIMATION_GENRE_ID = 16;
export const SUPERHERO_GENRE_KEY = "superhero";
export const SUPERHERO_KEYWORD_ID = "9715";

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

function searchableText(item: any) {
  return [
    item?.title,
    item?.name,
    item?.originalTitle,
    item?.original_title,
    item?.overview,
    item?.collectionName,
    item?.collection_name
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isSuperheroLike(item: any) {
  const text = searchableText(item);
  return /\b(superhero|super hero|marvel|dc comics|batman|superman|spider[\s-]?man|avengers|x[\s-]?men|iron man|captain america|wonder woman|aquaman|the flash|green lantern|thor|hulk|justice league|guardians of the galaxy|venom|deadpool|wolverine|black panther|fantastic four|daredevil|punisher)\b/i.test(text);
}

export function isHorrorLike(item: any) {
  const genres = item?.genres ?? [];
  if (genres.some((genre: Genre | any) => Number(genre?.id) === 27 || String(genre?.name ?? "").toLowerCase() === "horror")) return true;
  const text = searchableText(item);
  return /\b(horror|nightmare|nightmarish|haunted|ghost|demon|curse|cursed|slasher|zombie|vampire|possession|supernatural|terrifying|creature)\b/i.test(text);
}

export function matchesExcludedGenre(item: Pick<MediaSummary, "genres" | "originalLanguage" | "originCountries"> | any, excluded: string[]) {
  if (!excluded.length) return false;
  const genres = item?.genres ?? [];
  const genreIds = new Set(genres.map((genre: Genre | any) => String(genre?.id)));
  const anime = isAnimeLike(item);
  return excluded.some(value => {
    if (value === ANIME_EXCLUDE_KEY) return anime;
    if (value === SUPERHERO_GENRE_KEY) return isSuperheroLike(item);
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
  if (isSuperheroLike(item)) names.add("Superhero");
  if (isHorrorLike(item)) names.add("Horror");
  return [...names];
}
