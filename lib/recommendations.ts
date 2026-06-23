import { ensureMediaSummaries } from "@/lib/catalog";
import { fromDbMedia } from "@/lib/db-mappers";
import { discover, getMedia, getTrending } from "@/lib/tmdb";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { MediaKind, MediaSummary } from "@/lib/types";

type DbMedia = { id?: number; tmdb_id: number; kind: MediaKind; title: string };
type Signal = { media: DbMedia; weight: number; reason: string };
export type RecommendationFilters = { kind?: string; genre?: string; country?: string; year?: string; hideWatched?: boolean; hideListed?: boolean };
export type RecommendationEntry = { item: MediaSummary; reason: string };
export type RecommendationPage = { items: RecommendationEntry[]; nextCursor: string | null; total: number };

export async function invalidateRecommendations(userId: string) { const admin = createSupabaseAdminClient(); if (admin) await admin.from("recommendations").delete().eq("user_id", userId); }

export async function ensureRecommendations(userId: string, force = false) {
  const admin = createSupabaseAdminClient(); if (!admin) return;
  if (!force) { const latest = (await admin.from("recommendations").select("generated_at").eq("user_id", userId).order("generated_at", { ascending: false }).limit(1).maybeSingle()).data?.generated_at; if (latest && Date.now() - new Date(latest).getTime() < 24 * 60 * 60_000) return; }
  const [ratingResult, favoriteResult, progressResult] = await Promise.all([
    admin.from("ratings").select("score,media(id,tmdb_id,kind,title)").eq("user_id", userId).gte("score", 7).order("score", { ascending: false }).limit(16),
    admin.from("favorites").select("media(id,tmdb_id,kind,title)").eq("user_id", userId).limit(30),
    admin.from("progress").select("status,updated_at,media(id,tmdb_id,kind,title)").eq("user_id", userId).order("updated_at", { ascending: false }).limit(300)
  ]);
  const signals: Signal[] = []; const seedKeys = new Set<string>(); const add = (signal: Signal) => { const key = `${signal.media.kind}-${signal.media.tmdb_id}`; if (!seedKeys.has(key)) { seedKeys.add(key); signals.push(signal); } };
  for (const row of ratingResult.data ?? []) { const media = row.media as unknown as DbMedia; if (media) add({ media, weight: Number(row.score) * 1.1, reason: `Because you rated ${media.title} ${Number(row.score).toFixed(1)}/10` }); }
  for (const row of favoriteResult.data ?? []) { const media = row.media as unknown as DbMedia; if (media) add({ media, weight: 9, reason: `Because ${media.title} is a favorite` }); }
  for (const row of progressResult.data ?? []) { const media = row.media as unknown as DbMedia; if (media && row.status === "completed") add({ media, weight: 6.5, reason: `Because you completed ${media.title}` }); }
  const candidates = new Map<string, { item: MediaSummary; score: number; reason: string }>(); const affinities = new Map<number, number>(); const countryAffinities = new Map<string, number>();
  const details = await Promise.allSettled(signals.slice(0, 24).map(async signal => ({ signal, detail: await getMedia(signal.media.kind, signal.media.tmdb_id) })));
  for (const result of details) { if (result.status !== "fulfilled") continue; const { signal, detail } = result.value; detail.genres.forEach(genre => affinities.set(genre.id, (affinities.get(genre.id) ?? 0) + signal.weight)); detail.countries.forEach(country => countryAffinities.set(country, (countryAffinities.get(country) ?? 0) + signal.weight)); detail.recommendations.forEach((item, index) => { const key = `${item.kind}-${item.id}`; const existing = candidates.get(key); const score = signal.weight + Math.max(0, 20 - index) / 3 + item.voteAverage * .16; candidates.set(key, { item, score: (existing?.score ?? 0) + score, reason: existing && existing.score > score ? existing.reason : signal.reason }); }); }
  const topGenres = [...affinities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const affinityPools = topGenres.flatMap(([genreId]) => (["movie", "show"] as MediaKind[]).flatMap(kind =>
    [1, 2, 3, 4].map(page => discover(kind, { with_genres: String(genreId), sort_by: "vote_count.desc", "vote_average.gte": "5.5", "vote_count.gte": "40", page: String(page) }).then(data => ({ type: "affinity" as const, genreId, data })))
  ));
  const koreanDramaPools = [1, 2, 3, 4, 5].map(page => discover("show", { with_genres: "18", without_genres: "16", with_origin_country: "KR", with_original_language: "ko", sort_by: "vote_count.desc", "vote_count.gte": "20", page: String(page) }).then(data => ({ type: "kdrama" as const, genreId: 18, data })));
  const pools = await Promise.allSettled([...affinityPools, ...koreanDramaPools]);
  for (const result of pools) { if (result.status !== "fulfilled") continue; const affinity = result.value.type === "kdrama" ? countryAffinities.get("KR") ?? 0 : affinities.get(result.value.genreId) ?? 1; result.value.data.items.forEach((item, index) => { const key = `${item.kind}-${item.id}`; const score = affinity * .22 + item.voteAverage * .45 + Math.max(0, 20 - index) / 10; const existing = candidates.get(key); const reason = result.value.type === "kdrama" ? "A well-regarded Korean drama matching your filters" : "Because this fits genres you watch often"; if (!existing || score > existing.score) candidates.set(key, { item, score, reason }); }); }
  if (!candidates.size) (await getTrending()).forEach((item, index) => candidates.set(`${item.kind}-${item.id}`, { item, score: 20 - index, reason: "Trending while MovieTracker learns your taste" }));
  const ranked = [...candidates.values()].filter(entry => !seedKeys.has(`${entry.item.kind}-${entry.item.id}`)).sort((a, b) => b.score - a.score);
  const displayRanked = [...ranked];
  if (force) {
    const rotationSize = Math.min(72, displayRanked.length);
    const rotation = displayRanked.slice(0, rotationSize);
    for (let index = rotation.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(Math.random() * (index + 1));
      [rotation[index], rotation[swapWith]] = [rotation[swapWith], rotation[index]];
    }
    displayRanked.splice(0, rotationSize, ...rotation);
  }
  const mediaRows = await ensureMediaSummaries(displayRanked.map(entry => entry.item)); const ids = new Map(mediaRows.map(row => [`${row.kind}-${row.tmdb_id}`, row.id])); const now = new Date().toISOString();
  const records = displayRanked.map((entry, index) => ({ user_id: userId, media_id: ids.get(`${entry.item.kind}-${entry.item.id}`), score: force ? displayRanked.length - index : entry.score, reasons: [entry.reason], generated_at: now })).filter(row => row.media_id);
  if (records.length) { await admin.from("recommendations").delete().eq("user_id", userId); for (let index = 0; index < records.length; index += 500) { const { error } = await admin.from("recommendations").insert(records.slice(index, index + 500)); if (error) throw error; } }
}

export async function recommendationPage(supabase: any, userId: string, filters: RecommendationFilters, offset = 0, size = 24): Promise<RecommendationPage> {
  const [recommendations, watches, completed, lists, dismissals] = await Promise.all([
    supabase.from("recommendations").select("score,reasons,media(*)").eq("user_id", userId).is("dismissed_at", null).order("score", { ascending: false }).limit(1000),
    filters.hideWatched ? supabase.from("watch_events").select("media_id").eq("user_id", userId) : Promise.resolve({ data: [] }),
    filters.hideWatched ? supabase.from("progress").select("media_id").eq("user_id", userId).eq("status", "completed") : Promise.resolve({ data: [] }),
    filters.hideListed ? supabase.from("lists").select("id").eq("user_id", userId) : Promise.resolve({ data: [] }),
    supabase.from("recommendation_dismissals").select("media_id").eq("user_id", userId)
  ]);
  const watched = new Set([...(watches.data ?? []), ...(completed.data ?? [])].map((row: any) => row.media_id)); const dismissed = new Set((dismissals.data ?? []).map((row: any) => row.media_id)); const listIds = (lists.data ?? []).map((row: any) => row.id); const listedRows = filters.hideListed && listIds.length ? (await supabase.from("list_items").select("media_id").in("list_id", listIds)).data ?? [] : []; const listed = new Set(listedRows.map((row: any) => row.media_id));
  const filtered = (recommendations.data ?? []).map((row: any) => ({ ...row, media: Array.isArray(row.media) ? row.media[0] : row.media })).filter((row: any) => { const genres = row.media?.genres ?? []; const countries = row.media?.origin_countries ?? []; const isKdrama = row.media?.kind === "show" && row.media?.original_language === "ko" && countries.includes("KR") && genres.some((genre: any) => Number(genre.id) === 18) && !genres.some((genre: any) => Number(genre.id) === 16); return row.media && row.media.poster_path && !dismissed.has(row.media.id) && (!filters.kind || row.media.kind === filters.kind) && (!filters.country || countries.includes(filters.country)) && (!filters.year || row.media.release_date?.startsWith(filters.year)) && (!filters.genre || (filters.genre === "kdrama" ? isKdrama : genres.some((genre: any) => String(genre.id) === filters.genre))) && (!filters.hideWatched || !watched.has(row.media.id)) && (!filters.hideListed || !listed.has(row.media.id)); });
  const page = filtered.slice(offset, offset + size).map((row: any) => ({ item: fromDbMedia(row.media), reason: row.reasons?.[0] ?? "Chosen for your taste" })); return { items: page, nextCursor: offset + size < filtered.length ? String(offset + size) : null, total: filtered.length };
}
