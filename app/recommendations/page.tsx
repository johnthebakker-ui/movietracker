import { redirect } from "next/navigation";
import { InfiniteRecommendationGrid } from "@/components/infinite-recommendation-grid";
import { discover, getGenres, getMedia, getTrending } from "@/lib/tmdb";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MediaKind, MediaSummary } from "@/lib/types";
import { syncTraktForUser } from "@/lib/trakt";
import { withCommunityRatings } from "@/lib/community-ratings";

type Filters = { kind?: string; genre?: string; year?: string; unwatched?: string };
type DbMedia = { tmdb_id: number; kind: MediaKind; title: string };
type Signal = { media: DbMedia; weight: number; reason: string };

export default async function Recommendations({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams; const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null; if (!user || !supabase) redirect("/login");
  await syncTraktForUser(user.id).catch(error => console.error("Recommendation pre-sync failed", error));
  const genres = await getGenres();
  const [ratingResult, favoriteResult, progressResult] = await Promise.all([
    supabase.from("ratings").select("score,media(tmdb_id,kind,title)").eq("user_id", user.id).gte("score", 7).order("score", { ascending: false }).limit(12),
    supabase.from("favorites").select("media(tmdb_id,kind,title)").eq("user_id", user.id).limit(20),
    supabase.from("progress").select("status,updated_at,media(tmdb_id,kind,title)").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200)
  ]);
  const signals: Signal[] = []; const signalKeys = new Set<string>(); const addSignal = (signal: Signal) => { const key = `${signal.media.kind}-${signal.media.tmdb_id}`; if (!signalKeys.has(key)) { signalKeys.add(key); signals.push(signal); } };
  for (const row of ratingResult.data ?? []) { const media = row.media as unknown as DbMedia; if (media) addSignal({ media, weight: Number(row.score) * 1.1, reason: `Because you rated ${media.title} ${Number(row.score).toFixed(1)}/10` }); }
  for (const row of progressResult.data ?? []) { const media = row.media as unknown as DbMedia; if (media && row.status === "completed") addSignal({ media, weight: 6.5, reason: `Because you completed ${media.title}` }); }
  for (const row of favoriteResult.data ?? []) { const media = row.media as unknown as DbMedia; if (media) addSignal({ media, weight: 9, reason: `Because ${media.title} is a favorite` }); }

  const candidates = new Map<string, { item: MediaSummary; score: number; reason: string }>(); const genreAffinity = new Map<number, number>();
  const details = await Promise.allSettled(signals.slice(0, 24).map(async signal => ({ signal, detail: await getMedia(signal.media.kind, signal.media.tmdb_id) })));
  for (const result of details) { if (result.status !== "fulfilled") continue; const { signal, detail } = result.value; detail.genres.forEach(genre => genreAffinity.set(genre.id, (genreAffinity.get(genre.id) ?? 0) + signal.weight)); detail.recommendations.forEach((item, index) => { const key = `${item.kind}-${item.id}`; const existing = candidates.get(key); const score = signal.weight + Math.max(0, 20 - index) / 3 + item.voteAverage * .16; candidates.set(key, { item, score: (existing?.score ?? 0) + score, reason: existing && existing.score > score ? existing.reason : signal.reason }); }); }
  const genreNames = new Map(genres.map(genre => [genre.id, genre.name])); const topGenres = [...genreAffinity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const discoveryPools = await Promise.allSettled(topGenres.flatMap(([genreId]) => (["movie", "show"] as MediaKind[]).map(kind => discover(kind, { with_genres: String(genreId), sort_by: "vote_count.desc", "vote_average.gte": "6", "vote_count.gte": "80", page: "1" }).then(data => ({ genreId, data })))));
  for (const result of discoveryPools) { if (result.status !== "fulfilled") continue; const affinity = genreAffinity.get(result.value.genreId) ?? 0; for (const [index, item] of result.value.data.items.entries()) { const key = `${item.kind}-${item.id}`; const score = affinity * .22 + item.voteAverage * .45 + Math.max(0, 20 - index) / 10; const existing = candidates.get(key); if (!existing || score > existing.score) candidates.set(key, { item, score, reason: `Because you often watch ${genreNames.get(result.value.genreId) ?? "similar stories"}` }); } }
  if (!candidates.size) { const trending = await getTrending(); trending.forEach((item, index) => candidates.set(`${item.kind}-${item.id}`, { item, score: 20 - index, reason: "Trending while MovieTracker learns your taste" })); }
  const tracked = new Set((progressResult.data ?? []).map(row => { const media = row.media as unknown as DbMedia; return media ? `${media.kind}-${media.tmdb_id}` : ""; })); const hideTracked = filters.unwatched !== "0";
  const ranked = [...candidates.values()].filter(({ item }) => !signalKeys.has(`${item.kind}-${item.id}`)).sort((a, b) => b.score - a.score).filter(({ item }) => { if (filters.kind && item.kind !== filters.kind) return false; if (filters.genre && !item.genres.some(genre => String(genre.id) === filters.genre)) return false; if (filters.year && !item.releaseDate?.startsWith(filters.year)) return false; if (hideTracked && tracked.has(`${item.kind}-${item.id}`)) return false; return true; }).slice(0, 180);
  const ratedItems = await withCommunityRatings(ranked.map(entry => entry.item), supabase);
  const ratedRanked = ranked.map((entry, index) => ({ ...entry, item: ratedItems[index] }));
  return <main className="page"><div className="shell"><div className="eyebrow">Recalculated from ratings, favorites, and completed history</div><h1 className="display page-title">For you</h1><p className="overview recommendation-intro">Trakt imports now influence this page. Suggestions combine every strongly rated title, favorite, completed movie and completed series with broader genre discovery, then progressively load as you scroll.</p>
    <form className="recommendation-filter"><select className="select" name="kind" defaultValue={filters.kind ?? ""}><option value="">Movies & series</option><option value="movie">Movies</option><option value="show">Series</option></select><select className="select" name="genre" defaultValue={filters.genre ?? ""}><option value="">Every genre</option>{genres.map(genre => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select><input className="input" name="year" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="Release year" defaultValue={filters.year} /><label className="filter-checkbox"><input name="unwatched" value="0" type="checkbox" defaultChecked={filters.unwatched === "0"} /> Include tracked</label><button className="button accent">Update</button></form>
    {ratedRanked.length ? <InfiniteRecommendationGrid recommendations={ratedRanked} /> : <div className="empty-state"><h2 className="display">No matches today</h2><p className="muted">Relax a filter or include tracked titles.</p></div>}
  </div></main>;
}
