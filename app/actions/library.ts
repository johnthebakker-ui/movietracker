"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { getMedia, getSeason } from "@/lib/tmdb";
import { ensureMedia, ensureSeason } from "@/lib/catalog";
import { pushTraktHistory, pushTraktRating, pushTraktWatchlist, removeTraktHistory } from "@/lib/trakt";
import { isValidRating } from "@/lib/ratings";

const ratingValue = z.coerce.number().refine(isValidRating, "Rating must be from 1.0 to 10.0 in 0.1 steps");
const optionalRatingValue = z.preprocess(value => value === "" || value == null ? undefined : value, ratingValue.optional());

async function userClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?message=Sign+in+to+save+your+progress");
  return { supabase, user: data.user };
}

type WatchDateMode = "now" | "custom" | "release" | "unknown";

function resolveWatchDate(mode: WatchDateMode, customDate?: string, releaseDate?: string, timezoneOffset = 0) {
  if (mode === "unknown") return null;
  if (mode === "now") return new Date().toISOString();
  const source = mode === "release" ? releaseDate : customDate;
  if (!source) throw new Error(mode === "release" ? "This title has no known release date" : "Choose a custom watch date");
  const value = source.includes("T") ? new Date(new Date(`${source}:00Z`).getTime() + timezoneOffset * 60_000) : new Date(`${source}T12:00:00Z`);
  if (Number.isNaN(value.getTime()) || value.getTime() > Date.now() + 60_000) throw new Error("Choose a valid watch date that is not in the future");
  return value.toISOString();
}

async function reconcileShowProgress(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, mediaId: number) {
  if (!supabase) return;
  const [{ data: media }, { data: watches }, { data: current }] = await Promise.all([
    supabase.from("media").select("number_of_episodes,status").eq("id", mediaId).single(),
    supabase.from("watch_events").select("episode_id,episodes(seasons(season_number))").eq("user_id", userId).eq("media_id", mediaId).not("episode_id", "is", null),
    supabase.from("progress").select("status").eq("user_id", userId).eq("media_id", mediaId).maybeSingle()
  ]);
  const regularEpisodes = new Set((watches ?? []).filter((row: any) => { const episode = Array.isArray(row.episodes) ? row.episodes[0] : row.episodes; const season = Array.isArray(episode?.seasons) ? episode.seasons[0] : episode?.seasons; return season?.season_number !== 0; }).map((row: any) => row.episode_id));
  const total = Number(media?.number_of_episodes ?? 0);
  const complete = media?.status === "Ended" && total > 0 && regularEpisodes.size >= total;
  const status: "completed" | "watching" | "planned" | null = complete ? "completed" : regularEpisodes.size ? "watching" : (current?.status === "completed" || current?.status === "watching" ? "planned" : null);
  if (!status || (current?.status === status && status !== "completed")) return;
  const now = new Date().toISOString();
  await supabase.from("progress").upsert({ user_id: userId, media_id: mediaId, status, completed_at: status === "completed" ? now : null, updated_at: now });
}

export async function quickTrack(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  try {
    const { supabase, user } = await userClient();
    const tmdbId = Number(form.get("tmdbId"));
    const kind = form.get("kind") === "show" ? "show" : "movie";
    const intent = String(form.get("intent"));
    const detail = await getMedia(kind, tmdbId);
    const mediaId = await ensureMedia(detail);
    if (!mediaId) throw new Error("Catalog storage is not configured");
    if (intent === "favorite") await supabase.from("favorites").upsert({ user_id: user.id, media_id: mediaId }, { onConflict: "user_id,media_id" });
    if (intent === "planned" || intent === "completed") {
      const now = new Date().toISOString();
      await supabase.from("progress").upsert({ user_id: user.id, media_id: mediaId, status: intent, completed_at: intent === "completed" ? now : null, updated_at: now });
      if (intent === "completed" && kind === "movie") await supabase.from("watch_events").insert({ user_id: user.id, media_id: mediaId, duration_minutes: detail.runtime, watched_at: now });
    }
    try { if (intent === "planned") await pushTraktWatchlist(user.id, { kind, tmdbId }); if (intent === "completed" && kind === "movie") await pushTraktHistory(user.id, { kind: "movie", tmdbId, watchedAt: new Date().toISOString() }); } catch (error) { console.error("Trakt quick action push failed", error); }
    revalidatePath("/library"); revalidatePath("/history");
    return { status: "success", message: intent === "favorite" ? "Added to favorites" : intent === "completed" ? "Marked watched" : "Added to watchlist" };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Could not save that action" }; }
}

export async function setProgress(form: FormData) {
  const { supabase, user } = await userClient();
  const values = z.object({ mediaId: z.coerce.number().int().positive(), status: z.enum(["planned", "watching", "completed", "paused", "dropped"]), path: z.string() }).parse(Object.fromEntries(form));
  const now = new Date().toISOString();
  const { error } = await supabase.from("progress").upsert({
    user_id: user.id, media_id: values.mediaId, status: values.status,
    started_at: values.status === "watching" ? now : undefined,
    completed_at: values.status === "completed" ? now : null, updated_at: now
  });
  if (error) throw error;
  try { const { data: media } = await supabase.from("media").select("tmdb_id,kind").eq("id", values.mediaId).single(); if (media && values.status === "planned") await pushTraktWatchlist(user.id, { kind: media.kind, tmdbId: media.tmdb_id }); } catch (error) { console.error("Trakt progress push failed", error); }
  revalidatePath(values.path);
}

export async function addWatch(form: FormData) {
  const { supabase, user } = await userClient();
  const values = z.object({ mediaId: z.coerce.number(), episodeId: z.coerce.number().optional(), dateMode: z.enum(["now", "custom", "release", "unknown"]).default("now"), watchedAt: z.string().optional(), releaseDate: z.string().optional(), timezoneOffset: z.coerce.number().min(-840).max(840).optional(), path: z.string() }).parse(Object.fromEntries(form));
  const watchedAt = resolveWatchDate(values.dateMode, values.watchedAt, values.releaseDate, values.timezoneOffset);
  const { error } = await supabase.from("watch_events").insert({ user_id: user.id, media_id: values.mediaId, episode_id: values.episodeId || null, watched_at: watchedAt });
  if (error) throw error;
  const admin = createSupabaseAdminClient(); if (admin && watchedAt) { const watched = new Date(watchedAt); const start = new Date(watched.getTime() - 120000).toISOString(); const end = new Date(watched.getTime() + 120000).toISOString(); let tombstones = admin.from("watch_event_tombstones").delete().eq("user_id", user.id).eq("media_id", values.mediaId).gte("watched_at", start).lte("watched_at", end); tombstones = values.episodeId ? tombstones.eq("episode_id", values.episodeId) : tombstones.is("episode_id", null); await tombstones; }
  if (values.episodeId) await reconcileShowProgress(supabase, user.id, values.mediaId); else await supabase.from("progress").upsert({ user_id: user.id, media_id: values.mediaId, status: "completed", completed_at: watchedAt, updated_at: new Date().toISOString() });
  try { if (watchedAt && values.episodeId) { const { data: episode } = await supabase.from("episodes").select("tmdb_id").eq("id", values.episodeId).single(); if (episode?.tmdb_id) await pushTraktHistory(user.id, { kind: "episode", tmdbId: episode.tmdb_id, watchedAt }); } else if (watchedAt) { const { data: media } = await supabase.from("media").select("tmdb_id,kind").eq("id", values.mediaId).single(); if (media?.kind === "movie") await pushTraktHistory(user.id, { kind: "movie", tmdbId: media.tmdb_id, watchedAt }); } } catch (traktError) { console.error("Trakt watch push failed", traktError); }
  revalidatePath(values.path); revalidatePath("/history"); revalidatePath("/calendar");
}

export async function deleteWatchEvent(form: FormData) {
  const { supabase, user } = await userClient(); const eventId = String(form.get("eventId")); const path = String(form.get("path") || "/history");
  const { data: event } = await supabase.from("watch_events").select("id,media_id,episode_id,watched_at").eq("id", eventId).eq("user_id", user.id).maybeSingle(); if (!event) return;
  const admin = createSupabaseAdminClient(); let externalIds: string[] = [];
  if (admin) { if (event.watched_at) await admin.from("watch_event_tombstones").insert({ user_id: user.id, media_id: event.media_id, episode_id: event.episode_id, watched_at: event.watched_at }); externalIds = ((await admin.from("provider_sync_refs").select("external_id").eq("user_id", user.id).eq("provider", "trakt").eq("resource_type", "history").eq("local_id", eventId)).data ?? []).map(row => row.external_id); }
  const { error } = await supabase.from("watch_events").delete().eq("id", eventId).eq("user_id", user.id); if (error) throw error;
  try { await removeTraktHistory(user.id, externalIds); } catch (traktError) { console.error("Trakt history removal failed", traktError); }
  if (admin && externalIds.length) await admin.from("provider_sync_refs").delete().eq("user_id", user.id).eq("provider", "trakt").in("external_id", externalIds);
  if (event.episode_id) await reconcileShowProgress(supabase, user.id, event.media_id); else { const { count } = await supabase.from("watch_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("media_id", event.media_id).is("episode_id", null); if (!count) await supabase.from("progress").update({ status: "planned", completed_at: null, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("media_id", event.media_id).eq("status", "completed"); }
  revalidatePath(path); revalidatePath("/profile"); revalidatePath("/calendar"); revalidatePath("/library");
}

export async function bulkWatchEpisodes(form: FormData) {
  const { supabase, user } = await userClient();
  const mediaId = Number(form.get("mediaId"));
  const episodeIds = String(form.get("episodeIds") ?? "").split(",").map(Number).filter(Number.isFinite);
  const dateMode = z.enum(["now", "custom", "release", "unknown"]).parse(form.get("dateMode") ?? "now");
  const customDate = String(form.get("watchedAt") ?? "") || undefined; const timezoneOffset = Number(form.get("timezoneOffset") ?? 0);
  let episodeDates: Record<string, string | null> = {}; try { episodeDates = JSON.parse(String(form.get("episodeDates") ?? "{}")); } catch { episodeDates = {}; }
  if (!episodeIds.length) return;
  const { data: existing } = await supabase.from("watch_events").select("episode_id").eq("user_id", user.id).in("episode_id", episodeIds);
  const seen = new Set((existing ?? []).map(x => x.episode_id));
  const now = dateMode === "now" ? new Date().toISOString() : null;
  const eligibleIds = dateMode === "release" ? episodeIds.filter(id => { const date = episodeDates[String(id)]; return date && new Date(`${date}T12:00:00Z`).getTime() <= Date.now(); }) : episodeIds;
  const rows = eligibleIds.filter(id => !seen.has(id)).map(episode_id => ({ user_id: user.id, media_id: mediaId, episode_id, watched_at: dateMode === "now" ? now : resolveWatchDate(dateMode, customDate, episodeDates[String(episode_id)] ?? undefined, timezoneOffset) }));
  if (rows.length) { const { error } = await supabase.from("watch_events").insert(rows); if (error) throw error; }
  await reconcileShowProgress(supabase, user.id, mediaId);
  try { if (rows.length) { const { data: episodes } = await supabase.from("episodes").select("id,tmdb_id").in("id", rows.map(row => row.episode_id)); const dates = new Map(rows.map(row => [row.episode_id, row.watched_at])); await Promise.allSettled((episodes ?? []).filter(episode => episode.tmdb_id && dates.get(episode.id)).map(episode => pushTraktHistory(user.id, { kind: "episode", tmdbId: episode.tmdb_id!, watchedAt: dates.get(episode.id)! }))); } } catch (error) { console.error("Trakt bulk watch push failed", error); }
  revalidatePath(String(form.get("path"))); revalidatePath("/history"); revalidatePath("/calendar");
}

export async function markWholeShowWatched(form: FormData) {
  const { supabase, user } = await userClient();
  const mediaId = Number(form.get("mediaId")); const tmdbId = Number(form.get("tmdbId"));
  const dateMode = z.enum(["now", "custom", "release", "unknown"]).parse(form.get("dateMode") ?? "now"); const customDate = String(form.get("watchedAt") ?? "") || undefined; const timezoneOffset = Number(form.get("timezoneOffset") ?? 0);
  const show = await getMedia("show", tmdbId);
  for (const season of show.seasons) { const detail = await getSeason(tmdbId, season.seasonNumber); await ensureSeason(mediaId, detail); }
  const { data: seasons } = await supabase.from("seasons").select("id").eq("media_id", mediaId);
  const { data: episodes } = await supabase.from("episodes").select("id,tmdb_id,air_date").in("season_id", (seasons ?? []).map(x => x.id));
  const ids = (episodes ?? []).map(x => x.id);
  const now = dateMode === "now" ? new Date().toISOString() : null;
  let inserted: { episode_id: number; watched_at: string | null; tmdb_id?: number | null }[] = [];
  if (ids.length) {
    const { data: existing } = await supabase.from("watch_events").select("episode_id").eq("user_id", user.id).in("episode_id", ids);
    const seen = new Set((existing ?? []).map(x => x.episode_id));
    const byId = new Map((episodes ?? []).map(episode => [episode.id, episode]));
    const eligibleIds = dateMode === "release" ? ids.filter(id => { const date = byId.get(id)?.air_date; return date && new Date(`${date}T12:00:00Z`).getTime() <= Date.now(); }) : ids;
    inserted = eligibleIds.filter(id => !seen.has(id)).map(episode_id => { const episode = byId.get(episode_id); return { episode_id, watched_at: dateMode === "now" ? now : resolveWatchDate(dateMode, customDate, episode?.air_date ?? undefined, timezoneOffset), tmdb_id: episode?.tmdb_id }; });
    const rows = inserted.map(row => ({ user_id: user.id, media_id: mediaId, episode_id: row.episode_id, watched_at: row.watched_at }));
    if (rows.length) await supabase.from("watch_events").insert(rows);
  }
  const completedAt = dateMode === "unknown" ? null : dateMode === "now" ? now : inserted.map(row => row.watched_at).filter(Boolean).sort().at(-1) ?? new Date().toISOString();
  await reconcileShowProgress(supabase, user.id, mediaId);
  await supabase.from("progress").update({ completed_at: completedAt, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("media_id", mediaId).eq("status", "completed");
  try { await Promise.allSettled(inserted.filter(row => row.tmdb_id && row.watched_at).map(row => pushTraktHistory(user.id, { kind: "episode", tmdbId: row.tmdb_id!, watchedAt: row.watched_at! }))); } catch (error) { console.error("Trakt whole-show push failed", error); }
  revalidatePath(String(form.get("path"))); revalidatePath("/history"); revalidatePath("/calendar");
}

export async function removeTargetWatches(form: FormData) {
  const { supabase, user } = await userClient(); const mediaId = Number(form.get("mediaId")); const episodeId = form.get("episodeId") ? Number(form.get("episodeId")) : null; const path = String(form.get("path") || "/history");
  let query = supabase.from("watch_events").select("id,watched_at,episode_id").eq("user_id", user.id).eq("media_id", mediaId); query = episodeId ? query.eq("episode_id", episodeId) : query.is("episode_id", null); const { data: events } = await query;
  const ids = (events ?? []).map(event => event.id); if (!ids.length) return;
  const admin = createSupabaseAdminClient(); let externalIds: string[] = [];
  if (admin) {
    const dated = (events ?? []).filter(event => event.watched_at).map(event => ({ user_id: user.id, media_id: mediaId, episode_id: event.episode_id, watched_at: event.watched_at })); if (dated.length) await admin.from("watch_event_tombstones").insert(dated);
    externalIds = ((await admin.from("provider_sync_refs").select("external_id").eq("user_id", user.id).eq("provider", "trakt").eq("resource_type", "history").in("local_id", ids)).data ?? []).map(row => row.external_id);
  }
  const { error } = await supabase.from("watch_events").delete().eq("user_id", user.id).in("id", ids); if (error) throw error;
  try { if (externalIds.length) await removeTraktHistory(user.id, externalIds); } catch (error) { console.error("Trakt history removal failed", error); }
  if (admin && externalIds.length) await admin.from("provider_sync_refs").delete().eq("user_id", user.id).eq("provider", "trakt").in("external_id", externalIds);
  if (episodeId) await reconcileShowProgress(supabase, user.id, mediaId); else await supabase.from("progress").update({ status: "planned", completed_at: null, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("media_id", mediaId).eq("status", "completed");
  revalidatePath(path); revalidatePath("/history"); revalidatePath("/calendar"); revalidatePath("/library");
}

export async function rateTitle(form: FormData) {
  const { supabase, user } = await userClient();
  const values = z.object({ mediaId: z.coerce.number(), score: ratingValue, path: z.string() }).parse(Object.fromEntries(form));
  const { data: existing } = await supabase.from("ratings").select("id").eq("user_id", user.id).eq("media_id", values.mediaId).maybeSingle();
  const operation = existing ? supabase.from("ratings").update({ score: values.score, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id").single() : supabase.from("ratings").insert({ user_id: user.id, media_id: values.mediaId, score: values.score }).select("id").single();
  const { data: savedRating, error } = await operation;
  if (error) throw error;
  if (savedRating) await supabase.from("reviews").update({ rating_id: savedRating.id, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("media_id", values.mediaId);
  try { const { data: media } = await supabase.from("media").select("tmdb_id,kind").eq("id", values.mediaId).single(); if (media) { await pushTraktRating(user.id, { kind: media.kind, tmdbId: media.tmdb_id, score: values.score }); await supabase.from("ratings").update({ updated_at: new Date().toISOString() }).eq("id", savedRating.id); } } catch (traktError) { console.error("Trakt rating push failed", traktError); }
  revalidatePath(values.path);
}

export async function writeReview(form: FormData) {
  const { supabase, user } = await userClient();
  const values = z.object({ mediaId: z.coerce.number(), score: optionalRatingValue, title: z.string().max(120), body: z.string().min(1).max(10000), spoilers: z.string().optional(), path: z.string() }).parse(Object.fromEntries(form));
  let { data: rating } = await supabase.from("ratings").select("id,score").eq("user_id", user.id).eq("media_id", values.mediaId).maybeSingle();
  if (values.score !== undefined) {
    if (rating) { const result = await supabase.from("ratings").update({ score: values.score, updated_at: new Date().toISOString() }).eq("id", rating.id).select("id,score").single(); rating = result.data; if (result.error) throw result.error; }
    else { const result = await supabase.from("ratings").insert({ user_id: user.id, media_id: values.mediaId, score: values.score }).select("id,score").single(); rating = result.data; if (result.error) throw result.error; }
  }
  const { error } = await supabase.from("reviews").insert({ user_id: user.id, media_id: values.mediaId, rating_id: rating?.id ?? null, title: values.title || null, body: values.body, contains_spoilers: values.spoilers === "on" });
  if (error) throw error;
  if (values.score !== undefined) { try { const { data: media } = await supabase.from("media").select("tmdb_id,kind").eq("id", values.mediaId).single(); if (media) { await pushTraktRating(user.id, { kind: media.kind, tmdbId: media.tmdb_id, score: values.score }); if (rating?.id) await supabase.from("ratings").update({ updated_at: new Date().toISOString() }).eq("id", rating.id); } } catch (error) { console.error("Trakt review rating push failed", error); } }
  revalidatePath(values.path);
}

export async function rateTarget(form: FormData) {
  const { supabase, user } = await userClient();
  const values = z.object({ targetType: z.enum(["season", "episode"]), targetId: z.coerce.number().int().positive(), score: ratingValue, path: z.string() }).parse(Object.fromEntries(form));
  const column = values.targetType === "season" ? "season_id" : "episode_id";
  const { data: existing } = await supabase.from("ratings").select("id").eq("user_id", user.id).eq(column, values.targetId).maybeSingle();
  const payload = { score: values.score, updated_at: new Date().toISOString() };
  const operation = existing ? supabase.from("ratings").update(payload).eq("id", existing.id).select("id").single() : supabase.from("ratings").insert({ user_id: user.id, [column]: values.targetId, score: values.score }).select("id").single();
  const { data: savedRating, error } = await operation;
  if (error) throw error;
  if (savedRating) await supabase.from("reviews").update({ rating_id: savedRating.id, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq(column, values.targetId);
  revalidatePath(values.path);
}

export async function writeTargetReview(form: FormData) {
  const { supabase, user } = await userClient();
  const values = z.object({ targetType: z.enum(["season", "episode"]), targetId: z.coerce.number().int().positive(), score: optionalRatingValue, title: z.string().max(120), body: z.string().min(1).max(10000), spoilers: z.string().optional(), path: z.string() }).parse(Object.fromEntries(form));
  const column = values.targetType === "season" ? "season_id" : "episode_id";
  let { data: rating } = await supabase.from("ratings").select("id,score").eq("user_id", user.id).eq(column, values.targetId).maybeSingle();
  if (values.score !== undefined) {
    if (rating) { const result = await supabase.from("ratings").update({ score: values.score, updated_at: new Date().toISOString() }).eq("id", rating.id).select("id,score").single(); rating = result.data; if (result.error) throw result.error; }
    else { const result = await supabase.from("ratings").insert({ user_id: user.id, [column]: values.targetId, score: values.score }).select("id,score").single(); rating = result.data; if (result.error) throw result.error; }
  }
  const { error } = await supabase.from("reviews").insert({ user_id: user.id, [column]: values.targetId, rating_id: rating?.id ?? null, title: values.title || null, body: values.body, contains_spoilers: values.spoilers === "on" });
  if (error) throw error;
  revalidatePath(values.path);
}

export async function toggleFavorite(form: FormData) {
  const { supabase, user } = await userClient();
  const mediaId = Number(form.get("mediaId"));
  const path = String(form.get("path"));
  const { data } = await supabase.from("favorites").select("media_id").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle();
  if (data) await supabase.from("favorites").delete().eq("user_id", user.id).eq("media_id", mediaId);
  else await supabase.from("favorites").insert({ user_id: user.id, media_id: mediaId });
  revalidatePath(path);
}

export async function createList(form: FormData) {
  const { supabase, user } = await userClient();
  const name = String(form.get("name") ?? "").trim();
  const { error } = await supabase.from("lists").insert({ user_id: user.id, name, slug: `${slugify(name)}-${Date.now().toString(36)}`, description: String(form.get("description") ?? ""), visibility: String(form.get("visibility") ?? "public") });
  if (error) throw error;
  revalidatePath("/lists");
}

export type ListActionState = { status: "idle" | "success" | "error"; message: string };

export async function updateList(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  try {
    const { supabase, user } = await userClient();
    const values = z.object({
      listId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      description: z.string().max(1000),
      visibility: z.enum(["public", "followers", "private"]),
      featuredMediaId: z.string().optional(),
      removeCover: z.string().optional()
    }).parse({
      listId: form.get("listId"), name: form.get("name"), description: form.get("description") ?? "",
      visibility: form.get("visibility"), featuredMediaId: form.get("featuredMediaId") || undefined,
      removeCover: form.get("removeCover") || undefined
    });
    const { data: list, error: listError } = await supabase.from("lists").select("id,user_id,cover_url").eq("id", values.listId).eq("user_id", user.id).single();
    if (listError || !list) throw new Error("You do not have permission to edit this list");

    const featuredMediaId = values.featuredMediaId ? Number(values.featuredMediaId) : null;
    if (featuredMediaId) {
      const { count } = await supabase.from("list_items").select("id", { count: "exact", head: true }).eq("list_id", list.id).eq("media_id", featuredMediaId);
      if (!count) throw new Error("The selected main title is no longer in this list");
    }

    let coverUrl: string | null = values.removeCover ? null : list.cover_url;
    const cover = form.get("cover");
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > 5 * 1024 * 1024) throw new Error("Cover images must be 5 MB or smaller");
      const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      const extension = extensions[cover.type];
      if (!extension) throw new Error("Use a JPG, PNG, or WebP cover image");
      const storagePath = `${user.id}/lists/${list.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("profile-media").upload(storagePath, cover, { contentType: cover.type, upsert: false });
      if (uploadError) throw uploadError;
      coverUrl = supabase.storage.from("profile-media").getPublicUrl(storagePath).data.publicUrl;
    }

    const { error } = await supabase.from("lists").update({ name: values.name, description: values.description || null, visibility: values.visibility, cover_url: coverUrl, featured_media_id: featuredMediaId, updated_at: new Date().toISOString() }).eq("id", list.id).eq("user_id", user.id);
    if (error) throw error;
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
    revalidatePath("/lists"); revalidatePath(`/lists/${list.id}`); if (profile?.username) revalidatePath(`/profile/${profile.username}`);
    return { status: "success", message: "List updated" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update this list" };
  }
}

export async function addToList(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  try {
    const { supabase } = await userClient();
    const listId = String(form.get("listId"));
    const mediaId = Number(form.get("mediaId"));
    const [{ count }, { data: list }] = await Promise.all([
      supabase.from("list_items").select("id", { count: "exact", head: true }).eq("list_id", listId),
      supabase.from("lists").select("name").eq("id", listId).single()
    ]);
    const { error } = await supabase.from("list_items").upsert({ list_id: listId, media_id: mediaId, position: count ?? 0 }, { onConflict: "list_id,media_id" });
    if (error) throw error;
    revalidatePath(String(form.get("path")));
    return { status: "success", message: `Added to ${list?.name ?? "your list"}` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this title" };
  }
}

export async function removeFromList(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  try {
    const { supabase, user } = await userClient();
    const values = z.object({
      listId: z.string().uuid(),
      mediaId: z.coerce.number().int().positive(),
      path: z.string().startsWith("/lists/")
    }).parse(Object.fromEntries(form));
    const { data: list, error: listError } = await supabase.from("lists").select("id,name,featured_media_id").eq("id", values.listId).eq("user_id", user.id).single();
    if (listError || !list) throw new Error("You do not have permission to edit this list");
    const { error } = await supabase.from("list_items").delete().eq("list_id", list.id).eq("media_id", values.mediaId);
    if (error) throw error;
    if (Number(list.featured_media_id) === values.mediaId) await supabase.from("lists").update({ featured_media_id: null, updated_at: new Date().toISOString() }).eq("id", list.id).eq("user_id", user.id);
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
    revalidatePath(values.path); revalidatePath("/lists"); if (profile?.username) revalidatePath(`/profile/${profile.username}`);
    return { status: "success", message: `Removed from ${list.name}` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not remove this title" };
  }
}

export async function addCatalogTitleToList(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  try {
    const { supabase, user } = await userClient();
    const values = z.object({ listId: z.string().uuid(), tmdbId: z.coerce.number().int().positive(), kind: z.enum(["movie", "show"]) }).parse(Object.fromEntries(form));
    const { data: list, error: listError } = await supabase.from("lists").select("id,name").eq("id", values.listId).eq("user_id", user.id).single();
    if (listError || !list) throw new Error("You do not have permission to edit this list");
    const detail = await getMedia(values.kind, values.tmdbId);
    const mediaId = await ensureMedia(detail);
    if (!mediaId) throw new Error("Could not save this title");
    const [{ data: existing }, { count }] = await Promise.all([
      supabase.from("list_items").select("id").eq("list_id", list.id).eq("media_id", mediaId).maybeSingle(),
      supabase.from("list_items").select("id", { count: "exact", head: true }).eq("list_id", list.id)
    ]);
    if (existing) return { status: "success", message: `Already in ${list.name}` };
    const { error } = await supabase.from("list_items").insert({ list_id: list.id, media_id: mediaId, position: count ?? 0 });
    if (error) throw error;
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
    revalidatePath(`/lists/${list.id}`); revalidatePath("/lists"); if (profile?.username) revalidatePath(`/profile/${profile.username}`);
    return { status: "success", message: `Added to ${list.name}` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this title" };
  }
}
