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
  return /\b(superhero|super hero|marvel|mcu|dc comics|dc universe|batman|superman|man of steel|spider[\s-]?man|ant[\s-]?man|avengers|x[\s-]?men|iron man|captain america|captain marvel|doctor strange|dr\. strange|wonder woman|aquaman|the flash|green lantern|green arrow|thor|hulk|justice league|guardians of the galaxy|venom|deadpool|wolverine|black panther|black adam|fantastic four|daredevil|punisher|shazam|suicide squad|harley quinn|catwoman|batgirl|blade|moon knight|ms\. marvel|scarlet witch|wanda|vision|loki|hawkeye|falcon|winter soldier|agents of s\.?h\.?i\.?e\.?l\.?d)\b/i.test(text);
}

export function isHorrorLike(item: any) {
  const genres = item?.genres ?? [];
  if (genres.some((genre: Genre | any) => Number(genre?.id) === 27 || String(genre?.name ?? "").toLowerCase() === "horror")) return true;
  const text = searchableText(item);
  return /\b(horror|nightmare|nightmarish|haunted|ghost|demon|curse|cursed|slasher|zombie|vampire|possession|supernatural|terrifying|creature|monster|traps all those who enter|town they cannot escape|evil entity)\b/i.test(text);
}

export function isThrillerLike(item: any) {
  const genres = item?.genres ?? [];
  if (genres.some((genre: Genre | any) => Number(genre?.id) === 53 || String(genre?.name ?? "").toLowerCase() === "thriller")) return true;
  const text = searchableText(item);
  return /\b(thriller|suspense|suspenseful|serial killer|kidnap|kidnapped|abduct|abducted|conspiracy|stalker|psychological|murder mystery|tense|paranoia|manhunt|hostage)\b/i.test(text);
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
  if (isThrillerLike(item)) names.add("Thriller");
  return [...names];
}

export function mediaHasNormalizedGenre(item: Pick<MediaSummary, "genres" | "originalLanguage" | "originCountries"> | any, genreName?: string | null) {
  const target = String(genreName ?? "").trim().toLowerCase();
  if (!target) return false;
  return normalizeGenreNamesForStats(item).some(name => name.toLowerCase() === target);
}
