import Image from "@/components/app-image";
import Link from "next/link";
import { CalendarDays, Clock3, Film, History as HistoryIcon, RotateCcw, Tv } from "lucide-react";
import { redirect } from "next/navigation";
import { DeleteWatchEventForm } from "@/components/delete-watch-event-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { imageUrl } from "@/lib/tmdb";

type HistoryFilter = "all" | "movies" | "episodes";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const filter: HistoryFilter = type === "movies" || type === "episodes" ? type : "all";
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");
  const { data } = await supabase.from("watch_events").select("id,watched_at,duration_minutes,episode_id,media(id,tmdb_id,kind,title,poster_path,backdrop_path,runtime),episodes(name,episode_number,still_path,seasons(season_number,name))").eq("user_id", user.id).order("watched_at", { ascending: false, nullsFirst: false }).limit(500);
  const allEvents: any[] = [...(data ?? [])];
  const mediaIds = [...new Set(allEvents.map((event: any) => event.media?.id).filter(Boolean))];
  const { data: ratingRows } = mediaIds.length ? await supabase.from("ratings").select("media_id,score").eq("user_id", user.id).in("media_id", mediaIds) : { data: [] as any[] };
  const ratingByMediaId = new Map((ratingRows ?? []).map((row: any) => [row.media_id, Number(row.score)]));
  allEvents.sort((a, b) => b.watched_at && a.watched_at ? new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime() : b.watched_at ? 1 : a.watched_at ? -1 : 0);
  const events = allEvents.filter(event => filter === "all" || (filter === "episodes" ? Boolean(event.episode_id) : !event.episode_id));
  const grouped = new Map<string, typeof events>();
  events.forEach(event => { const day = event.watched_at ? event.watched_at.slice(0, 10) : "unknown"; grouped.set(day, [...(grouped.get(day) ?? []), event]); });
  const totalMinutes = allEvents.reduce((sum, event: any) => sum + (event.duration_minutes ?? event.media?.runtime ?? 0), 0);
  const uniqueTitles = new Set(allEvents.map((event: any) => `${event.media?.kind}-${event.media?.tmdb_id}`)).size;
  const occurrenceTotals = new Map<string, number>();
  allEvents.forEach((event: any) => { const key = event.episode_id ? `episode-${event.episode_id}` : `media-${event.media?.tmdb_id}`; occurrenceTotals.set(key, (occurrenceTotals.get(key) ?? 0) + 1); });
  const remaining = new Map(occurrenceTotals);
  return <main className="page"><div className="shell narrow-shell">
    <div className="page-heading-row"><div><div className="eyebrow">Every play, kept in order</div><h1 className="display page-title">Watch history</h1></div><Link className="button ghost" href="/calendar"><CalendarDays size={17} /> Open calendar</Link></div>
    <div className="history-summary"><div><HistoryIcon size={18} /><strong>{allEvents.length}</strong><span>watch events</span></div><div><Clock3 size={18} /><strong>{Math.round(totalMinutes / 60)}h</strong><span>screen time</span></div><div><Film size={18} /><strong>{uniqueTitles}</strong><span>unique titles</span></div></div>
    <nav className="pill-nav" aria-label="History filters"><Link className={filter === "all" ? "active" : ""} href="/history">Everything</Link><Link className={filter === "movies" ? "active" : ""} href="/history?type=movies">Movies</Link><Link className={filter === "episodes" ? "active" : ""} href="/history?type=episodes">Episodes</Link></nav>
    {grouped.size ? <div className="history-timeline">{[...grouped.entries()].map(([day, dayEvents]) => <section className="history-day" key={day}>
      <div className="history-date"><strong>{day === "unknown" ? "Unknown" : new Date(`${day}T12:00:00`).toLocaleDateString("en", { weekday: "short", day: "numeric" })}</strong><span>{day === "unknown" ? "Watched date not specified" : new Date(`${day}T12:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" })}</span></div>
      <div className="history-event-list">{dayEvents.map((event: any) => {
        const episode = event.episodes; const media = event.media; const season = Array.isArray(episode?.seasons) ? episode.seasons[0] : episode?.seasons;
        const key = event.episode_id ? `episode-${event.episode_id}` : `media-${media?.tmdb_id}`; const watchNumber = remaining.get(key) ?? 1; remaining.set(key, watchNumber - 1); const rewatchNumber = watchNumber - 1;
        const artwork = imageUrl(episode?.still_path ?? media?.backdrop_path ?? media?.poster_path, "w500");
        const rating = media?.id ? ratingByMediaId.get(media.id) : null;
        return <div className="history-event" key={event.id}><Link className="history-event-link" href={`/title/${media?.kind}/${media?.tmdb_id}${episode ? `/season/${season?.season_number}/episode/${episode.episode_number}` : ""}`}>
          <div className="history-art">{artwork ? <Image src={artwork} alt="" fill sizes="140px" /> : <div />}{rating != null && <b className="history-rating-badge">{rating.toFixed(1)}<small>/10</small></b>}</div>
          <div className="history-event-copy"><span className="eyebrow">{episode ? `S${season?.season_number ?? "?"} E${episode.episode_number}` : media?.kind === "show" ? "Series" : "Film"}</span><strong>{media?.title}</strong>{episode && <span>{episode.name}</span>}</div>
          </Link><div className="history-event-meta">{rewatchNumber > 0 && <span><RotateCcw size={13} /> Rewatch {rewatchNumber}</span>}<time>{event.watched_at ? new Date(event.watched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Date unknown"}</time>{media?.kind === "show" ? <Tv size={15} /> : <Film size={15} />}<DeleteWatchEventForm eventId={event.id} title={media?.title ?? "title"} /></div>
        </div>;
      })}</div>
    </section>)}</div> : <div className="empty-state"><HistoryIcon size={28} /><h2 className="display">Your diary starts with a watch</h2><p className="muted">Log a movie or episode and its exact date will appear here.</p><Link className="button accent" href="/discover">Find something to watch</Link></div>}
  </div></main>;
}
