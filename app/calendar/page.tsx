import Image from "@/components/app-image";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Film, Tv } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMedia, getSeason, imageUrl } from "@/lib/tmdb";

type CalendarMode = "upcoming" | "watched";
type CalendarEvent = {
  id: string;
  date: string;
  href: string;
  title: string;
  subtitle: string;
  artwork: string | null;
  kind: "movie" | "episode";
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; mode?: string }> }) {
  const params = await searchParams;
  const mode: CalendarMode = params.mode === "watched" ? "watched" : "upcoming";
  const now = new Date();
  const requested = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : monthKey(now);
  const [year, month] = requested.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");

  let events: CalendarEvent[] = [];
  if (mode === "watched") {
    const { data } = await supabase.from("watch_events")
      .select("id,watched_at,media(tmdb_id,kind,title,poster_path,backdrop_path),episodes(name,episode_number,still_path,seasons(season_number))")
      .eq("user_id", user.id)
      .not("watched_at", "is", null)
      .gte("watched_at", start.toISOString())
      .lt("watched_at", end.toISOString())
      .order("watched_at", { ascending: true });
    events = (data ?? []).map((row: any) => {
      const media = row.media;
      const episode = row.episodes;
      const season = Array.isArray(episode?.seasons) ? episode.seasons[0] : episode?.seasons;
      return {
        id: row.id,
        date: row.watched_at.slice(0, 10),
        href: `/title/${media?.kind}/${media?.tmdb_id}${episode ? `/season/${season?.season_number}/episode/${episode.episode_number}` : ""}`,
        title: media?.title ?? "Unknown title",
        subtitle: episode ? `S${season?.season_number ?? "?"} E${episode.episode_number} · ${episode.name}` : `Watched at ${new Date(row.watched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        artwork: episode?.still_path ?? media?.backdrop_path ?? media?.poster_path ?? null,
        kind: episode ? "episode" : "movie"
      };
    });
  } else {
    const { data: tracked } = await supabase.from("progress").select("status,media(tmdb_id,kind,title,poster_path)").eq("user_id", user.id).in("status", ["watching", "planned", "paused"]).order("updated_at", { ascending: false }).limit(100);
    const shows = (tracked ?? []).map((row: any) => row.media).filter((media: any) => media?.kind === "show");
    const eventLists = await Promise.all(shows.map(async (show: any): Promise<CalendarEvent[]> => {
      try {
        const detail = await getMedia("show", show.tmdb_id);
        const raw = detail.raw as any;
        const candidateNumbers = new Set<number>();
        if (raw.next_episode_to_air?.season_number) candidateNumbers.add(raw.next_episode_to_air.season_number);
        if (raw.last_episode_to_air?.season_number) candidateNumbers.add(raw.last_episode_to_air.season_number);
        if (detail.numberOfSeasons) candidateNumbers.add(detail.numberOfSeasons);
        const seasons = await Promise.all([...candidateNumbers].filter(number => number > 0).slice(-3).map(number => getSeason(show.tmdb_id, number)));
        return seasons.flatMap(season => season.episodes.filter(episode => episode.airDate && episode.airDate >= start.toISOString().slice(0, 10) && episode.airDate < end.toISOString().slice(0, 10)).map(episode => ({
          id: `${show.tmdb_id}-${season.seasonNumber}-${episode.episodeNumber}`,
          date: episode.airDate!,
          href: `/title/show/${show.tmdb_id}/season/${season.seasonNumber}/episode/${episode.episodeNumber}`,
          title: show.title,
          subtitle: `S${season.seasonNumber} E${episode.episodeNumber} · ${episode.name}`,
          artwork: episode.stillPath ?? show.poster_path,
          kind: "episode" as const
        })));
      } catch { return []; }
    }));
    events = eventLists.flat();
  }

  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.forEach(event => eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]));
  const leading = (start.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: leading + daysInMonth }, (_, index) => index < leading ? null : index - leading + 1);
  const today = new Date().toISOString().slice(0, 10);
  const monthHref = (date: Date) => `/calendar?mode=${mode}&month=${monthKey(date)}`;
  const eventDays = [...eventsByDate.entries()].sort(([left], [right]) => left.localeCompare(right));

  return <main className="page"><div className="shell">
    <div className="page-heading-row"><div><div className="eyebrow">Your viewing schedule and diary</div><h1 className="display page-title">Calendar</h1><p className="muted">Switch between episodes due to air and everything you watched.</p></div><Link className="button ghost" href="/history">View full history</Link></div>
    <nav className="pill-nav calendar-mode" aria-label="Calendar mode"><Link className={mode === "upcoming" ? "active" : ""} href={`/calendar?mode=upcoming&month=${requested}`}><CalendarDays size={14} /> Upcoming</Link><Link className={mode === "watched" ? "active" : ""} href={`/calendar?mode=watched&month=${requested}`}><Check size={14} /> Watched</Link></nav>
    <div className="calendar-toolbar"><Link className="icon-button" href={monthHref(previous)} aria-label="Previous month"><ChevronLeft size={18} /></Link><h2 className="display">{start.toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" })}</h2><Link className="icon-button" href={monthHref(next)} aria-label="Next month"><ChevronRight size={18} /></Link></div>
    <div className="calendar-shell"><div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => {
      if (!day) return <div className="calendar-cell muted-cell" key={`blank-${index}`} />;
      const date = `${requested}-${String(day).padStart(2, "0")}`;
      const dayEvents = eventsByDate.get(date) ?? [];
      return <div className={`calendar-cell ${date === today ? "today" : ""}`} key={date}><div className="calendar-day-number">{day}</div>{dayEvents.map(event => <Link className={`calendar-event ${mode === "watched" ? "watched" : ""}`} href={event.href} key={event.id}><div className="calendar-event-image">{imageUrl(event.artwork, "w300") ? <Image src={imageUrl(event.artwork, "w300")!} alt="" fill sizes="180px" /> : event.kind === "movie" ? <Film size={16} /> : <Tv size={16} />}</div><div><strong>{event.title}</strong><span>{event.subtitle}</span></div></Link>)}</div>;
    })}</div></div>
    <div className="calendar-mobile">
      <div className="calendar-mobile-month">
        <div className="calendar-mobile-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
        <div className="calendar-mobile-grid">{cells.map((day, index) => {
          if (!day) return <span className="blank" key={`mobile-blank-${index}`} />;
          const date = `${requested}-${String(day).padStart(2, "0")}`;
          const count = eventsByDate.get(date)?.length ?? 0;
          const content = <><strong>{day}</strong>{count > 0 && <i aria-label={`${count} ${count === 1 ? "event" : "events"}`}>{count}</i>}</>;
          return count > 0 ? <a className={date === today ? "today" : ""} href={`#calendar-day-${date}`} key={date}>{content}</a> : <span className={date === today ? "today" : ""} key={date}>{content}</span>;
        })}</div>
      </div>
      {eventDays.length > 0 && <div className="calendar-mobile-agenda">{eventDays.map(([date, dayEvents]) => <section id={`calendar-day-${date}`} key={date}>
        <header><time dateTime={date}>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</time><span>{dayEvents.length}</span></header>
        <div>{dayEvents.map(event => <Link className={`calendar-mobile-event ${mode === "watched" ? "watched" : ""}`} href={event.href} key={event.id}><div className="calendar-mobile-event-image">{imageUrl(event.artwork, "w300") ? <Image src={imageUrl(event.artwork, "w300")!} alt="" fill sizes="96px" /> : event.kind === "movie" ? <Film size={18} /> : <Tv size={18} />}</div><div><strong>{event.title}</strong><span>{event.subtitle}</span></div><ChevronRight size={17} /></Link>)}</div>
      </section>)}</div>}
    </div>
    {!events.length && <div className="calendar-empty-note"><CalendarDays size={19} /><span>{mode === "watched" ? "Nothing was logged in this month." : "No upcoming episodes found for this month. Track a series to populate it."}</span></div>}
  </div></main>;
}
