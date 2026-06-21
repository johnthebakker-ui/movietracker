import "server-only";
import { env } from "@/lib/env";
import { ensureMedia, ensureSeason } from "@/lib/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getMedia, getSeason } from "@/lib/tmdb";
import { decryptTraktToken, encryptTraktToken } from "@/lib/trakt-crypto";
import type { MediaKind } from "@/lib/types";

const TRAKT_API = "https://api.trakt.tv";

type ConnectionRow = {
  user_id: string; trakt_user_id: string | null; trakt_username: string | null;
  access_token_encrypted: string; refresh_token_encrypted: string; token_expires_at: string;
  scope: string | null; sync_enabled: boolean; last_synced_at: string | null; last_activities: Record<string, any>; last_error: string | null;
};
type TraktAuth = { row: ConnectionRow; accessToken: string; refreshToken: string };
function configured() {
  if (!env.traktClientId || !env.traktClientSecret || !env.traktRedirectUri || !env.traktEncryptionKey) throw new Error("Trakt environment variables are incomplete");
}

export function traktAuthorizeUrl(state: string) {
  configured(); const url = new URL("https://trakt.tv/oauth/authorize");
  url.searchParams.set("response_type", "code"); url.searchParams.set("client_id", env.traktClientId!); url.searchParams.set("redirect_uri", env.traktRedirectUri!); url.searchParams.set("state", state); return url.toString();
}

export async function exchangeTraktCode(code: string) {
  configured(); const response = await fetch(`${TRAKT_API}/oauth/token`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": "MovieTracker/0.1", "trakt-api-version": "2", "trakt-api-key": env.traktClientId! }, body: JSON.stringify({ code, client_id: env.traktClientId, client_secret: env.traktClientSecret, redirect_uri: env.traktRedirectUri, grant_type: "authorization_code" }), cache: "no-store" });
  if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string; error_description?: string }; const reason = payload.error_description ?? payload.error; throw new Error(`Trakt authorization failed (${response.status})${reason ? `: ${reason}` : response.status === 403 ? ": Trakt rejected the application credentials or callback URL" : ""}`); }
  return response.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number; created_at: number; scope?: string }>;
}

async function refreshTraktAuth(auth: TraktAuth): Promise<TraktAuth> {
  configured(); const response = await fetch(`${TRAKT_API}/oauth/token`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": "MovieTracker/0.1", "trakt-api-version": "2", "trakt-api-key": env.traktClientId! }, body: JSON.stringify({ refresh_token: auth.refreshToken, client_id: env.traktClientId, client_secret: env.traktClientSecret, redirect_uri: env.traktRedirectUri, grant_type: "refresh_token" }), cache: "no-store" });
  if (!response.ok) throw new Error(`Trakt token refresh failed (${response.status})`);
  const token = await response.json() as { access_token: string; refresh_token: string; expires_in: number; created_at: number; scope?: string };
  const admin = createSupabaseAdminClient(); if (!admin) throw new Error("Supabase service client is unavailable");
  const expires = new Date((token.created_at + token.expires_in) * 1000).toISOString();
  await admin.from("trakt_connections").update({ access_token_encrypted: encryptTraktToken(token.access_token), refresh_token_encrypted: encryptTraktToken(token.refresh_token), token_expires_at: expires, scope: token.scope ?? auth.row.scope, updated_at: new Date().toISOString() }).eq("user_id", auth.row.user_id);
  return { row: { ...auth.row, token_expires_at: expires }, accessToken: token.access_token, refreshToken: token.refresh_token };
}

export async function getTraktConnection(userId: string): Promise<TraktAuth | null> {
  const admin = createSupabaseAdminClient(); if (!admin) return null;
  const { data, error } = await admin.from("trakt_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  let auth: TraktAuth = { row: data as ConnectionRow, accessToken: decryptTraktToken(data.access_token_encrypted), refreshToken: decryptTraktToken(data.refresh_token_encrypted) };
  if (new Date(data.token_expires_at).getTime() < Date.now() + 120_000) auth = await refreshTraktAuth(auth);
  return auth;
}

function apiHeaders(auth: TraktAuth) { return { "content-type": "application/json", accept: "application/json", "user-agent": "MovieTracker/0.1", authorization: `Bearer ${auth.accessToken}`, "trakt-api-version": "2", "trakt-api-key": env.traktClientId! }; }

async function traktFetch(auth: TraktAuth, path: string, init?: RequestInit) {
  const response = await fetch(`${TRAKT_API}${path}`, { ...init, headers: { ...apiHeaders(auth), ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!response.ok) throw new Error(`Trakt request ${path} failed (${response.status})`); return response;
}

export async function getTraktUser(accessToken: string) {
  configured(); const auth = { accessToken, refreshToken: "", row: {} as ConnectionRow }; const response = await traktFetch(auth, "/users/settings"); return response.json() as Promise<any>;
}

export async function saveTraktConnection(userId: string, token: { access_token: string; refresh_token: string; expires_in: number; created_at: number; scope?: string }, settings: any) {
  const admin = createSupabaseAdminClient(); if (!admin) throw new Error("Supabase service client is unavailable");
  const user = settings.user ?? settings; const expires = new Date((token.created_at + token.expires_in) * 1000).toISOString();
  const { error } = await admin.from("trakt_connections").upsert({ user_id: userId, trakt_user_id: String(user.ids?.trakt ?? ""), trakt_username: user.username ?? user.ids?.slug ?? null, access_token_encrypted: encryptTraktToken(token.access_token), refresh_token_encrypted: encryptTraktToken(token.refresh_token), token_expires_at: expires, scope: token.scope ?? null, sync_enabled: true, last_error: null, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function paged(auth: TraktAuth, path: string, maxPages = 50): Promise<any[]> {
  const all: any[] = []; const separator = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= maxPages; page++) { const response = await traktFetch(auth, `${path}${separator}page=${page}&limit=100`); const rows = await response.json() as any[]; all.push(...rows); const pages = Number(response.headers.get("x-pagination-page-count") ?? page); if (page >= pages || rows.length < 100) break; }
  return all;
}

async function hydrateMedia(kind: MediaKind, tmdbId: number) { const detail = await getMedia(kind, tmdbId); const id = await ensureMedia(detail); if (!id) throw new Error("Could not store TMDB title"); return { id, detail }; }

async function importHistory(userId: string, auth: TraktAuth, startAt?: string) {
  const admin = createSupabaseAdminClient(); if (!admin) throw new Error("Supabase service client is unavailable");
  const suffix = startAt ? `?start_at=${encodeURIComponent(startAt)}` : "";
  const [movies, episodes] = await Promise.all([paged(auth, `/sync/history/movies${suffix}`), paged(auth, `/sync/history/episodes${suffix}`)]);
  let imported = 0; const mediaCache = new Map<string, { id: number; detail: any }>(); const seasonCache = new Map<string, number>(); const touchedShows = new Set<number>();
  for (const row of [...movies.map(row => ({ ...row, _kind: "movie" })), ...episodes.map(row => ({ ...row, _kind: "episode" }))]) {
    const externalId = String(row.id); const { data: seen } = await admin.from("provider_sync_refs").select("id").eq("user_id", userId).eq("provider", "trakt").eq("resource_type", "history").eq("external_id", externalId).maybeSingle(); if (seen) continue;
    try {
      let mediaId: number; let episodeId: number | null = null; let duration: number | null = null;
      if (row._kind === "movie") {
        const tmdbId = Number(row.movie?.ids?.tmdb); if (!tmdbId) continue; const key = `movie-${tmdbId}`; let media = mediaCache.get(key); if (!media) { media = await hydrateMedia("movie", tmdbId); mediaCache.set(key, media); } mediaId = media.id; duration = media.detail.runtime;
        await admin.from("progress").upsert({ user_id: userId, media_id: mediaId, status: "completed", completed_at: row.watched_at, updated_at: row.watched_at });
      } else {
        const showTmdb = Number(row.show?.ids?.tmdb); const seasonNumber = Number(row.episode?.season); const episodeTmdb = Number(row.episode?.ids?.tmdb); if (!showTmdb || !seasonNumber) continue;
        const mediaKey = `show-${showTmdb}`; let media = mediaCache.get(mediaKey); if (!media) { media = await hydrateMedia("show", showTmdb); mediaCache.set(mediaKey, media); } mediaId = media.id; touchedShows.add(mediaId);
        const seasonKey = `${showTmdb}-${seasonNumber}`; let seasonId = seasonCache.get(seasonKey); if (!seasonId) { const season = await getSeason(showTmdb, seasonNumber); const stored = await ensureSeason(mediaId, season); if (!stored) continue; seasonId = stored; seasonCache.set(seasonKey, stored); }
        let query = admin.from("episodes").select("id,runtime").eq("season_id", seasonId); query = episodeTmdb ? query.eq("tmdb_id", episodeTmdb) : query.eq("episode_number", Number(row.episode?.number)); const localEpisode = (await query.maybeSingle()).data; if (!localEpisode) continue; episodeId = localEpisode.id; duration = localEpisode.runtime;
        const { data: progress } = await admin.from("progress").select("status").eq("user_id", userId).eq("media_id", mediaId).maybeSingle(); if (!progress || progress.status === "planned") await admin.from("progress").upsert({ user_id: userId, media_id: mediaId, status: "watching", current_episode_id: episodeId, started_at: row.watched_at, updated_at: row.watched_at });
      }
      const watchedAt = new Date(row.watched_at); const nearStart = new Date(watchedAt.getTime() - 2 * 60_000).toISOString(); const nearEnd = new Date(watchedAt.getTime() + 2 * 60_000).toISOString();
      let tombstoneQuery = admin.from("watch_event_tombstones").select("id").eq("user_id", userId).eq("media_id", mediaId!).gte("watched_at", nearStart).lte("watched_at", nearEnd); tombstoneQuery = episodeId ? tombstoneQuery.eq("episode_id", episodeId) : tombstoneQuery.is("episode_id", null); const tombstone = (await tombstoneQuery.limit(1).maybeSingle()).data;
      if (tombstone) { await admin.from("provider_sync_refs").insert({ user_id: userId, provider: "trakt", resource_type: "history", external_id: externalId, local_table: "watch_event_tombstones", local_id: tombstone.id }); continue; }
      let matchingQuery = admin.from("watch_events").select("id").eq("user_id", userId).eq("media_id", mediaId!).gte("watched_at", nearStart).lte("watched_at", nearEnd); matchingQuery = episodeId ? matchingQuery.eq("episode_id", episodeId) : matchingQuery.is("episode_id", null); const localMatch = (await matchingQuery.limit(1).maybeSingle()).data;
      if (localMatch) { await admin.from("provider_sync_refs").insert({ user_id: userId, provider: "trakt", resource_type: "history", external_id: externalId, local_table: "watch_events", local_id: localMatch.id }); continue; }
      const { data: watch, error } = await admin.from("watch_events").insert({ user_id: userId, media_id: mediaId!, episode_id: episodeId, watched_at: row.watched_at, duration_minutes: duration }).select("id").single(); if (error) throw error;
      await admin.from("provider_sync_refs").insert({ user_id: userId, provider: "trakt", resource_type: "history", external_id: externalId, local_table: "watch_events", local_id: watch.id }); imported++;
    } catch (error) { console.error("Trakt history item import failed", error); }
  }
  for (const mediaId of touchedShows) { const { data: media } = await admin.from("media").select("status,number_of_episodes").eq("id", mediaId).single(); const { data: watches } = await admin.from("watch_events").select("episode_id").eq("user_id", userId).eq("media_id", mediaId).not("episode_id", "is", null); const watchedCount = new Set((watches ?? []).map(row => row.episode_id)).size; const complete = media?.status === "Ended" && Number(media.number_of_episodes) > 0 && watchedCount >= Number(media.number_of_episodes); await admin.from("progress").upsert({ user_id: userId, media_id: mediaId, status: complete ? "completed" : "watching", completed_at: complete ? new Date().toISOString() : null, updated_at: new Date().toISOString() }); }
  return imported;
}

async function importRatings(userId: string, auth: TraktAuth) {
  const admin = createSupabaseAdminClient(); if (!admin) throw new Error("Supabase service client is unavailable"); let imported = 0;
  const [movies, shows] = await Promise.all([paged(auth, "/sync/ratings/movies"), paged(auth, "/sync/ratings/shows")]);
  for (const row of [...movies.map(row => ({ ...row, _kind: "movie" })), ...shows.map(row => ({ ...row, _kind: "show" }))]) { const tmdbId = Number((row.movie ?? row.show)?.ids?.tmdb); if (!tmdbId) continue; try { const media = await hydrateMedia(row._kind as MediaKind, tmdbId); const score = Math.max(.5, Math.min(5, Number(row.rating) / 2)); const { data: existing } = await admin.from("ratings").select("id,updated_at").eq("user_id", userId).eq("media_id", media.id).maybeSingle(); if (existing && new Date(existing.updated_at).getTime() >= new Date(row.rated_at).getTime()) continue; if (existing) await admin.from("ratings").update({ score, updated_at: row.rated_at }).eq("id", existing.id); else await admin.from("ratings").insert({ user_id: userId, media_id: media.id, score, created_at: row.rated_at, updated_at: row.rated_at }); imported++; } catch (error) { console.error("Trakt rating import failed", error); } }
  return imported;
}

async function importWatchlist(userId: string, auth: TraktAuth) {
  const admin = createSupabaseAdminClient(); if (!admin) throw new Error("Supabase service client is unavailable"); let imported = 0;
  const [movies, shows] = await Promise.all([paged(auth, "/sync/watchlist/movies"), paged(auth, "/sync/watchlist/shows")]);
  for (const row of [...movies.map(row => ({ ...row, _kind: "movie" })), ...shows.map(row => ({ ...row, _kind: "show" }))]) { const tmdbId = Number((row.movie ?? row.show)?.ids?.tmdb); if (!tmdbId) continue; try { const media = await hydrateMedia(row._kind as MediaKind, tmdbId); const { data: existing } = await admin.from("progress").select("status").eq("user_id", userId).eq("media_id", media.id).maybeSingle(); if (!existing) { await admin.from("progress").insert({ user_id: userId, media_id: media.id, status: "planned", updated_at: row.listed_at ?? new Date().toISOString() }); imported++; } } catch (error) { console.error("Trakt watchlist import failed", error); } }
  return imported;
}

async function reconcileShowProgress(userId: string) {
  const admin = createSupabaseAdminClient(); if (!admin) return;
  const { data: rows } = await admin.from("progress").select("media_id,status,media(kind,status,number_of_episodes)").eq("user_id", userId).in("status", ["watching", "completed"]);
  for (const row of rows ?? []) { const media = Array.isArray(row.media) ? row.media[0] : row.media; if (!media || media.kind !== "show" || media.status !== "Ended" || !media.number_of_episodes) continue; const { data: watches } = await admin.from("watch_events").select("episode_id").eq("user_id", userId).eq("media_id", row.media_id).not("episode_id", "is", null); const completed = new Set((watches ?? []).map(watch => watch.episode_id)).size >= Number(media.number_of_episodes); if (completed && row.status !== "completed") await admin.from("progress").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId).eq("media_id", row.media_id); }
}

export async function syncTraktForUser(userId: string, force = false) {
  const admin = createSupabaseAdminClient(); const auth = await getTraktConnection(userId); if (!admin || !auth || !auth.row.sync_enabled) return { skipped: true, history: 0, ratings: 0, watchlist: 0 };
  if (!force && auth.row.last_synced_at && Date.now() - new Date(auth.row.last_synced_at).getTime() < 5 * 60_000) { await reconcileShowProgress(userId); return { skipped: true, history: 0, ratings: 0, watchlist: 0 }; }
  try {
    const activitiesResponse = await traktFetch(auth, "/sync/last_activities"); const activities = await activitiesResponse.json() as Record<string, any>;
    const firstSync = !auth.row.last_synced_at; const changed = JSON.stringify(activities) !== JSON.stringify(auth.row.last_activities ?? {});
    if (!force && !firstSync && !changed) { await reconcileShowProgress(userId); await admin.from("trakt_connections").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("user_id", userId); return { skipped: true, history: 0, ratings: 0, watchlist: 0 }; }
    const startAt = firstSync ? undefined : new Date(new Date(auth.row.last_synced_at!).getTime() - 10 * 60_000).toISOString();
    const history = await importHistory(userId, auth, startAt); const ratings = await importRatings(userId, auth); const watchlist = await importWatchlist(userId, auth); await reconcileShowProgress(userId);
    await admin.from("trakt_connections").update({ last_synced_at: new Date().toISOString(), last_activities: activities, last_error: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
    return { skipped: false, history, ratings, watchlist };
  } catch (error) { const message = error instanceof Error ? error.message : "Trakt synchronization failed"; await admin.from("trakt_connections").update({ last_error: message, updated_at: new Date().toISOString() }).eq("user_id", userId); throw error; }
}

async function postSync(userId: string, path: string, body: unknown) { const auth = await getTraktConnection(userId); if (!auth || !auth.row.sync_enabled) return; await traktFetch(auth, path, { method: "POST", body: JSON.stringify(body) }); }
export async function pushTraktHistory(userId: string, item: { kind: "movie" | "episode"; tmdbId: number; watchedAt?: string }) { const entry = { watched_at: item.watchedAt ?? new Date().toISOString(), ids: { tmdb: item.tmdbId } }; await postSync(userId, "/sync/history", item.kind === "movie" ? { movies: [entry] } : { episodes: [entry] }); }
export async function pushTraktRating(userId: string, item: { kind: MediaKind; tmdbId: number; score: number }) { const entry = { rated_at: new Date().toISOString(), rating: Math.round(item.score * 2), ids: { tmdb: item.tmdbId } }; await postSync(userId, "/sync/ratings", item.kind === "movie" ? { movies: [entry] } : { shows: [entry] }); }
export async function pushTraktWatchlist(userId: string, item: { kind: MediaKind; tmdbId: number }) { const entry = { ids: { tmdb: item.tmdbId } }; await postSync(userId, "/sync/watchlist", item.kind === "movie" ? { movies: [entry] } : { shows: [entry] }); }
export async function removeTraktHistory(userId: string, historyIds: string[]) { const ids = historyIds.map(Number).filter(Number.isFinite); if (ids.length) await postSync(userId, "/sync/history/remove", { ids }); }
