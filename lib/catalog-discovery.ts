import { discover } from "@/lib/tmdb";
import type { MediaKind, MediaSummary } from "@/lib/types";
import { ANIME_EXCLUDE_KEY, ANIMATION_GENRE_ID, matchesExcludedGenre, parseExcludedGenres } from "@/lib/genre-utils";

export type DiscoveryFormat = MediaKind | "all";
export type DiscoveryParams = Record<string, string | undefined>;

const validYear = (value?: string) => value && /^\d{4}$/.test(value) ? Number(value) : null;

function sortItems(items: MediaSummary[], sort: string) {
  if (sort === "rating") return items.sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount);
  if (sort === "newest") return items.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  return items.sort((a, b) => b.popularity - a.popularity);
}

export async function discoverCatalog(params: DiscoveryParams) {
  const kdrama = params.genre === "kdrama";
  const requestedFormat: DiscoveryFormat = params.kind === "movie" || params.kind === "show" ? params.kind : "all";
  const format: DiscoveryFormat = kdrama ? "show" : requestedFormat;
  const excludedGenres = parseExcludedGenres(params.excludeGenres);
  if (params.hideAnimation === "1" && !excludedGenres.includes(String(ANIMATION_GENRE_ID))) excludedGenres.push(String(ANIMATION_GENRE_ID));
  const tmdbExcludedGenres = excludedGenres.filter(value => value !== ANIME_EXCLUDE_KEY && value !== String(ANIMATION_GENRE_ID)).join(",");
  const yearMode = params.yearMode === "range" ? "range" : "exact";
  const exactYear = validYear(params.year); const fromYear = validYear(params.fromYear); const toYear = validYear(params.toYear);
  const invalidRange = yearMode === "range" && fromYear !== null && toYear !== null && fromYear > toYear;
  const dateFrom = yearMode === "exact" && exactYear ? `${exactYear}-01-01` : yearMode === "range" && fromYear ? `${fromYear}-01-01` : undefined;
  const dateTo = yearMode === "exact" && exactYear ? `${exactYear}-12-31` : yearMode === "range" && toYear ? `${toYear}-12-31` : undefined;
  const legacySort = params.sort ?? "popularity.desc";
  const sort = legacySort.includes("vote_average") ? "rating" : legacySort.includes("release_date") || legacySort.includes("air_date") || legacySort === "newest" ? "newest" : "popularity";
  const common: Record<string, string | undefined> = {
    with_genres: kdrama ? "18" : params.genre,
    without_genres: kdrama ? "16" : tmdbExcludedGenres || undefined,
    with_origin_country: kdrama ? "KR" : params.country,
    with_original_language: kdrama ? "ko" : undefined,
    "vote_average.gte": params.rating,
    "vote_count.gte": params.rating || sort === "rating" ? "50" : kdrama ? "20" : "5",
    include_null_first_air_dates: "false",
    page: params.page
  };
  const filterExcluded = (items: MediaSummary[]) => items.filter(item => !matchesExcludedGenre(item, excludedGenres));
  const optionsFor = (kind: MediaKind) => ({
    ...common,
    sort_by: sort === "rating" ? "vote_average.desc" : sort === "newest" ? kind === "movie" ? "primary_release_date.desc" : "first_air_date.desc" : "popularity.desc",
    "primary_release_date.gte": kind === "movie" ? dateFrom : undefined,
    "primary_release_date.lte": kind === "movie" ? dateTo : undefined,
    "first_air_date.gte": kind === "show" ? dateFrom : undefined,
    "first_air_date.lte": kind === "show" ? dateTo : undefined
  });
  if (invalidRange) return { format, invalidRange, items: [] as MediaSummary[], page: 1, totalPages: 1 };
  if (format !== "all") { const data = await discover(format, optionsFor(format)); return { format, invalidRange, ...data, items: filterExcluded(data.items) }; }
  const [movies, shows] = await Promise.all([discover("movie", optionsFor("movie")), discover("show", optionsFor("show"))]);
  const items = sortItems(filterExcluded([...movies.items, ...shows.items]), sort);
  return { format, invalidRange, items, page: Math.max(movies.page, shows.page), totalPages: Math.max(movies.totalPages, shows.totalPages) };
}

export function discoveryApiFilters(params: DiscoveryParams) {
  return Object.fromEntries(["genre", "country", "rating", "sort", "yearMode", "year", "fromYear", "toYear", "excludeGenres", "hideAnimation"].map(key => [key, params[key]]).filter((entry): entry is [string, string] => Boolean(entry[1])));
}
