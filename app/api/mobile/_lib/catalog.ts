import { NextResponse } from "next/server";
import { ensureMedia, ensureMediaSummaries, ensureSeason } from "@/lib/catalog";
import { getExternalRatings } from "@/lib/external-ratings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { discover, getCollection, getCompany, getEpisode, getMedia, getSeason } from "@/lib/tmdb";
import type { EpisodeDetail, MediaDetail, MediaKind, MediaSummary, SeasonDetail } from "@/lib/types";
import { withCommunityRatings } from "@/lib/community-ratings";

export const ok = (body: unknown) => NextResponse.json(body);

export function badRequest(message = "Invalid request") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function isMediaKind(value: string): value is MediaKind {
  return value === "movie" || value === "show";
}

export async function mobileAuth() {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  return { supabase, user };
}

export function serializeExternalRatings(ratings: Awaited<ReturnType<typeof getExternalRatings>>) {
  return ratings.map(rating => ({ label: rating.source, value: rating.value }));
}

export function mediaImages(item: MediaDetail) {
  return [...(item.images?.backdrops ?? []), ...(item.images?.posters ?? [])].slice(0, 20);
}

export async function ensureTitleState(item: MediaDetail) {
  try {
    return await ensureMedia(item);
  } catch (error) {
    console.error("Mobile API catalog hydration failed", error);
    return null;
  }
}

export async function titleUserState(mediaId: number | null, item: MediaDetail, supabase: any, user: any) {
  let progressStatus: string | null = null;
  let userRating: number | null = null;
  let favorite = false;
  let watched = false;
  let lists: Array<{ id: string; name: string; contains: boolean }> = [];
  let dismissedKeys = new Set<string>();
  let notInterested = false;
  let myReview: any = null;

  if (!supabase || !mediaId || !user) return { progressStatus, userRating, favorite, watched, lists, dismissedKeys, notInterested, myReview };

  const reviewSelect = "id,title,body,created_at,updated_at,user_id,rating_id,contains_spoilers,ratings(score)";
  const [progress, rating, favoriteRow, listRows, memberships, watchCount, dismissals, review] = await Promise.all([
    supabase.from("progress").select("status").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
    supabase.from("ratings").select("score").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
    supabase.from("favorites").select("media_id").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
    supabase.from("lists").select("id,name").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("list_items").select("list_id").eq("media_id", mediaId),
    supabase.from("watch_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("media_id", mediaId).is("episode_id", null),
    supabase.from("recommendation_dismissals").select("media_id,media(tmdb_id,kind)").eq("user_id", user.id),
    supabase.from("reviews").select(reviewSelect).eq("user_id", user.id).eq("media_id", mediaId).maybeSingle()
  ]);

  const containing = new Set((memberships.data ?? []).map((row: any) => row.list_id));
  progressStatus = progress.data?.status ?? null;
  userRating = typeof rating.data?.score === "number" ? Number(rating.data.score) : null;
  favorite = Boolean(favoriteRow.data);
  watched = Boolean(watchCount.count);
  lists = (listRows.data ?? []).map((list: any) => ({ ...list, contains: containing.has(list.id) }));
  (dismissals.data ?? []).forEach((row: any) => {
    if (row.media_id === mediaId) notInterested = true;
    const media = Array.isArray(row.media) ? row.media[0] : row.media;
    if (media) dismissedKeys.add(`${media.kind}-${media.tmdb_id}`);
  });
  myReview = review.data ? mapTargetReview(review.data, item) : null;

  return { progressStatus, userRating, favorite, watched, lists, dismissedKeys, notInterested, myReview };
}

export async function titleReviews(mediaId: number | null, item: MediaDetail, supabase: any) {
  if (!supabase || !mediaId) return [];
  const { data } = await supabase
    .from("reviews")
    .select("id,title,body,created_at,updated_at,user_id,rating_id,contains_spoilers,ratings(score)")
    .eq("media_id", mediaId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((review: any) => mapTargetReview(review, item));
}

export async function titleCommunityRating(mediaId: number | null, supabase: any) {
  if (!supabase || !mediaId) return null;
  const { data } = await supabase.from("ratings").select("score").eq("media_id", mediaId);
  const rows = data ?? [];
  return rows.length ? rows.reduce((sum: number, row: any) => sum + Number(row.score), 0) / rows.length : null;
}

export async function titleCollectionAndRecommendations(item: MediaDetail, supabase: any, dismissedKeys = new Set<string>()) {
  const collectionItems = item.kind === "movie" && item.collectionTmdbId
    ? (await getCollection(item.collectionTmdbId)).filter(part => part.id !== item.id && !dismissedKeys.has(`movie-${part.id}`))
    : [];
  const collectionKeys = new Set(collectionItems.map(part => `${part.kind}-${part.id}`));
  const recommendations = item.recommendations.filter(candidate => !dismissedKeys.has(`${candidate.kind}-${candidate.id}`) && !collectionKeys.has(`${candidate.kind}-${candidate.id}`));
  const [collection, ratedRecommendations] = await Promise.all([
    withCommunityRatings(collectionItems, supabase),
    withCommunityRatings(recommendations, supabase)
  ]);
  await ensureMediaSummaries([...collection, ...ratedRecommendations]).catch(() => undefined);
  return { collection, recommendations: ratedRecommendations };
}

export async function companyPage(id: number, kind: MediaKind, page: number, supabase: any) {
  const dateKey = kind === "movie" ? "primary_release_date" : "first_air_date";
  const result = await discover(kind, { with_companies: String(id), sort_by: "popularity.desc", [`${dateKey}.lte`]: undefined, page: String(page) });
  const items = await withCommunityRatings(result.items, supabase);
  await ensureMediaSummaries(items).catch(() => undefined);
  return { ...result, items };
}

export async function personCredits(id: number, supabase: any) {
  const { getPerson } = await import("@/lib/tmdb");
  const person = await getPerson(id);
  const credits = await withCommunityRatings(person.credits, supabase);
  await ensureMediaSummaries(credits).catch(() => undefined);
  return { ...person, credits };
}

export async function companyPayload(id: number, supabase: any) {
  const company = await getCompany(id);
  const [movies, shows] = await Promise.all([
    withCommunityRatings(company.movies.items, supabase),
    withCommunityRatings(company.shows.items, supabase)
  ]);
  await ensureMediaSummaries([...movies, ...shows]).catch(() => undefined);
  return {
    ...company,
    movies: { ...company.movies, items: movies },
    shows: { ...company.shows, items: shows }
  };
}

export async function episodePayload(showId: number, seasonNumber: number, episodeNumber: number) {
  const [show, season, episode] = await Promise.all([
    getMedia("show", showId),
    getSeason(showId, seasonNumber),
    getEpisode(showId, seasonNumber, episodeNumber)
  ]);
  let mediaId: number | null = null;
  let seasonId: number | null = null;
  let episodeDbId: number | null = null;
  try {
    mediaId = await ensureMedia(show);
    if (mediaId) {
      seasonId = await ensureSeason(mediaId, season);
      const supabase = await createSupabaseServerClient();
      if (supabase && seasonId) {
        episodeDbId = (await supabase.from("episodes").select("id").eq("season_id", seasonId).eq("episode_number", episodeNumber).maybeSingle()).data?.id ?? null;
      }
    }
  } catch (error) {
    console.error("Mobile episode hydration failed", error);
  }
  return { show, season, episode, mediaId, seasonId, episodeDbId };
}

export async function episodeFeedback(episodeId: number | null, show: MediaSummary, supabase: any, user: any) {
  let reviews: any[] = [];
  let myReview: any = null;
  let communityRating: number | null = null;
  let userRating: number | null = null;
  let watched = false;
  if (!supabase || !episodeId) return { reviews, myReview, communityRating, userRating, watched };

  const reviewSelect = "id,title,body,created_at,updated_at,user_id,rating_id,contains_spoilers,ratings(score)";
  const [reviewRows, ratingRows, myReviewRow, watchRow] = await Promise.all([
    supabase.from("reviews").select(reviewSelect).eq("episode_id", episodeId).order("created_at", { ascending: false }).limit(20),
    supabase.from("ratings").select("score,user_id").eq("episode_id", episodeId),
    user ? supabase.from("reviews").select(reviewSelect).eq("user_id", user.id).eq("episode_id", episodeId).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("watch_events").select("id").eq("user_id", user.id).eq("episode_id", episodeId).limit(1).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const rows = ratingRows.data ?? [];
  reviews = (reviewRows.data ?? []).map((review: any) => mapTargetReview(review, show, "episode"));
  myReview = myReviewRow.data ? mapTargetReview(myReviewRow.data, show, "episode") : null;
  communityRating = rows.length ? rows.reduce((sum: number, row: any) => sum + Number(row.score), 0) / rows.length : null;
  userRating = user ? Number(rows.find((row: any) => row.user_id === user.id)?.score ?? 0) || null : null;
  watched = Boolean(watchRow.data);
  return { reviews, myReview, communityRating, userRating, watched };
}

export function mapTargetReview(review: any, item: Pick<MediaSummary, "kind" | "title" | "posterPath" | "backdropPath">, suffix?: string) {
  const rating = Array.isArray(review.ratings) ? review.ratings[0] : review.ratings;
  const score = Number(rating?.score);
  return {
    id: review.id,
    title: review.title || "Review",
    body: review.body ?? "",
    created_at: review.created_at,
    updated_at: review.updated_at,
    userId: review.user_id ?? null,
    ratingId: review.rating_id ?? null,
    containsSpoilers: Boolean(review.contains_spoilers),
    kind: item.kind,
    mediaTitle: suffix ? `${item.title} ${suffix}` : item.title,
    artwork: item.backdropPath ?? item.posterPath ?? null,
    score: Number.isFinite(score) ? score : null,
    item
  };
}

export function mapEpisode(episode: EpisodeDetail) {
  return {
    id: episode.id,
    name: episode.name,
    overview: episode.overview,
    episode_number: episode.episodeNumber,
    air_date: episode.airDate,
    still_path: episode.stillPath,
    runtime: episode.runtime,
    vote_average: episode.voteAverage,
    vote_count: episode.voteCount,
    credits: { cast: episode.cast ?? [], crew: episode.crew ?? [] },
    raw: { images: { stills: episode.images ?? [] }, videos: { results: episode.videos ?? [] }, external_ids: episode.externalIds ?? {} }
  };
}

export function mapSeason(season: SeasonDetail) {
  return {
    id: season.id,
    season_number: season.seasonNumber,
    name: season.name,
    overview: season.overview,
    poster_path: season.posterPath,
    air_date: season.airDate,
    episode_count: season.episodeCount
  };
}
