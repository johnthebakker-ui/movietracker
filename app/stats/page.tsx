import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const statusOrder = ["completed", "watching", "planned", "paused", "dropped"] as const;
type Status = typeof statusOrder[number];
type GenreStat = { name: string; total: number; statuses: Record<Status, number> };

export default async function StatsPage() {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");
  const [events, ratings, progress] = await Promise.all([
    supabase.from("watch_events").select("watched_at,duration_minutes,media(runtime)").eq("user_id", user.id),
    supabase.from("ratings").select("score").eq("user_id", user.id),
    supabase.from("progress").select("status,media(id,genres)").eq("user_id", user.id)
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
    for (const genre of media?.genres ?? []) {
      const name = typeof genre === "string" ? genre : genre?.name;
      if (!name) continue;
      const entry = genreMap.get(name) ?? { name, total: 0, statuses: { completed: 0, watching: 0, planned: 0, paused: 0, dropped: 0 } };
      entry.total += 1;
      entry.statuses[status] += 1;
      genreMap.set(name, entry);
    }
  }
  const topGenres = [...genreMap.values()].sort((left, right) => right.total - left.total).slice(0, 6);
  const maxGenreCount = topGenres[0]?.total ?? 1;
  return <main className="page"><div className="shell">
    <div className="eyebrow">The numbers behind your taste</div><h1 className="display page-title">Statistics</h1>
    <div className="stat-grid"><div className="stat-card"><div className="stat-value">{watches.length}</div><div className="muted">watch events</div></div><div className="stat-card"><div className="stat-value">{Math.round(minutes / 60)}h</div><div className="muted">screen time</div></div><div className="stat-card"><div className="stat-value">{complete}</div><div className="muted">completed titles</div></div><div className="stat-card"><div className="stat-value">{average}</div><div className="muted">average rating</div></div></div>
    <section className="section"><div className="section-head"><div><div className="eyebrow">Your recurring moods</div><h2 className="display">Top genres</h2></div></div>
      {topGenres.length ? <div className="genre-stats-panel"><div className="genre-status-legend">{statusOrder.map(status => <span className={status} key={status}><i />{status}</span>)}</div>{topGenres.map(genre => <div className="genre-stat-row" key={genre.name}><strong>{genre.name}</strong><div className="genre-stat-bar" aria-label={`${genre.total} tracked titles`}><div className="genre-stat-fill" style={{ width: `${genre.total / maxGenreCount * 100}%` }}>{statusOrder.map(status => genre.statuses[status] > 0 && <span className={status} style={{ width: `${genre.statuses[status] / genre.total * 100}%` }} title={`${genre.statuses[status]} ${status}`} key={status} />)}</div></div><span>{genre.total}</span></div>)}</div> : <div className="empty-state"><h2 className="display">A blank slate</h2><p className="muted">Track a title and your genre profile will grow here.</p></div>}
    </section>
  </div></main>;
}
