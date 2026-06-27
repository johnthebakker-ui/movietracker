import { redirect } from "next/navigation";
import Link from "next/link";
import { MediaCard } from "@/components/media-card";
import { withCommunityRatings } from "@/lib/community-ratings";
import { fromDbMedia } from "@/lib/db-mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mediaHasNormalizedGenre, normalizeGenreNamesForStats } from "@/lib/genre-utils";

const statusOrder = ["completed", "watching", "planned", "paused", "dropped"] as const;
type Status = typeof statusOrder[number];
type GenreStat = { name: string; total: number; statuses: Record<Status, number> };
type StatsSearchParams = Promise<{ genre?: string | string[] }>;

export default async function StatsPage({ searchParams }: { searchParams?: StatsSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const selectedGenre = typeof params.genre === "string" ? params.genre.trim() : "";
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");
  const [events, ratings, progress] = await Promise.all([
    supabase.from("watch_events").select("watched_at,duration_minutes,media(runtime)").eq("user_id", user.id),
    supabase.from("ratings").select("score").eq("user_id", user.id),
    supabase.from("progress").select("status,media(id,tmdb_id,kind,title,overview,poster_path,backdrop_path,release_date,end_date,status,vote_average,vote_count,popularity,runtime,genres,original_language,origin_countries,collection_tmdb_id,collection_name,collection_poster_path)").eq("user_id", user.id)
  ]);
  const watches = events.data ?? [];
  const progressRows = progress.data ?? [];
  const minutes = watches.reduce((sum: number, event: any) => sum + (event.duration_minutes ?? event.media?.runtime ?? 0), 0);
  const average = ratings.data?.length ? (ratings.data.reduce((sum: number, rating: any) => sum + Number(rating.score), 0) / ratings.data.length).toFixed(1) : "—";
  const complete = progressRows.filter(row => row.status === "completed").length;
  const genreMap = new Map<string, GenreStat>();
  for (const row of progressRows as any[]) {
    const status = statusOrder.includes(row.status as Status) ? row.status as Status : "planned";
    const media = Array.isArray(row.media) ? row.media[0] : row.media;
    for (const name of normalizeGenreNamesForStats(media)) {
      const entry = genreMap.get(name) ?? { name, total: 0, statuses: { completed: 0, watching: 0, planned: 0, paused: 0, dropped: 0 } };
      entry.total += 1;
      entry.statuses[status] += 1;
      genreMap.set(name, entry);
    }
  }
  const topGenres = [...genreMap.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name)).slice(0, 12);
  const maxGenreCount = topGenres[0]?.total ?? 1;
  const selectedRows = selectedGenre ? (progressRows as any[])
    .map(row => {
      const media = Array.isArray(row.media) ? row.media[0] : row.media;
      return media && mediaHasNormalizedGenre(media, selectedGenre) ? { status: row.status as Status, item: fromDbMedia(media) } : null;
    })
    .filter(Boolean) as { status: Status; item: ReturnType<typeof fromDbMedia> }[] : [];
  const ratedSelected = selectedRows.length ? await withCommunityRatings(selectedRows.map(row => row.item), supabase) : [];
  const selectedItems = selectedRows.map((row, index) => ({ ...row, item: ratedSelected[index] ?? row.item }));
  return <main className="page"><div className="shell">
    <div className="stats-heading"><div className="eyebrow">The numbers behind your taste</div><h1 className="display page-title">Statistics</h1></div>
    <div className="stat-grid"><div className="stat-card"><div className="stat-value">{watches.length}</div><div className="muted">watch events</div></div><div className="stat-card"><div className="stat-value">{Math.round(minutes / 60)}h</div><div className="muted">screen time</div></div><div className="stat-card"><div className="stat-value">{complete}</div><div className="muted">completed titles</div></div><div className="stat-card"><div className="stat-value">{average}</div><div className="muted">average rating</div></div></div>
    <section className="section"><div className="section-head"><div><div className="eyebrow">Your recurring moods</div><h2 className="display">Top genres</h2></div></div>
      {topGenres.length ? <div className="genre-stats-panel"><div className="genre-status-legend">{statusOrder.map(status => <span className={status} key={status}><i />{status}</span>)}</div>{topGenres.map(genre => <Link className={`genre-stat-row ${selectedGenre === genre.name ? "active" : ""}`} href={`/stats?genre=${encodeURIComponent(genre.name)}`} key={genre.name} aria-label={`View your ${genre.name} titles`}><strong>{genre.name}</strong><div className="genre-stat-bar" aria-label={`${genre.total} tracked titles`}><div className="genre-stat-fill" style={{ width: `${genre.total / maxGenreCount * 100}%` }}>{statusOrder.map(status => genre.statuses[status] > 0 && <span className={status} style={{ width: `${genre.statuses[status] / genre.total * 100}%` }} title={`${genre.statuses[status]} ${status}`} key={status} />)}</div></div><span>{genre.total}</span></Link>)}</div> : <div className="empty-state"><h2 className="display">A blank slate</h2><p className="muted">Track a title and your genre profile will grow here.</p></div>}
    </section>
    {selectedGenre && <section className="section genre-detail-section"><div className="section-head"><div><div className="eyebrow">Genre shelf</div><h2 className="display">{selectedGenre}</h2><p className="muted">Movies and shows from your library that are counted under this genre.</p></div><Link className="text-link" href="/stats">Clear genre</Link></div>
      {selectedItems.length ? <div className="media-grid genre-detail-grid">{selectedItems.map(({ item, status }) => <div className="genre-detail-card" key={`${item.kind}-${item.id}`}><MediaCard item={item} progressLabel={status ? `${String(status).slice(0, 1).toUpperCase()}${String(status).slice(1)}` : undefined} /></div>)}</div> : <div className="empty-state"><h2 className="display">Nothing here yet</h2><p className="muted">No tracked titles matched this genre.</p></div>}
    </section>}
  </div></main>;
}
