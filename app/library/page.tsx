import Link from "next/link";
import { Heart, List as ListIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { MediaCard } from "@/components/media-card";
import { withCommunityRatings } from "@/lib/community-ratings";
import { fromDbMedia } from "@/lib/db-mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { status?: string; view?: string };

export default async function Library({ searchParams }: { searchParams: Promise<Params> }) {
  const { status, view } = await searchParams;
  const favoritesMode = view === "favorites";
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");

  let rows: { status?: string; media: any }[] = [];
  if (favoritesMode) {
    const { data } = await supabase.from("favorites").select("media(*)").eq("user_id", user.id).order("position");
    rows = (data ?? []).map((row: any) => ({ media: Array.isArray(row.media) ? row.media[0] : row.media })).filter(row => row.media);
  } else {
    let query = supabase.from("progress").select("status,updated_at,media(*)").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data } = await query;
    rows = (data ?? []).map((row: any) => ({ ...row, media: Array.isArray(row.media) ? row.media[0] : row.media })).filter(row => row.media);
  }

  const watchingMediaIds = rows.filter(row => row.status === "watching" && row.media?.kind === "show").map(row => row.media.id);
  const latestEpisodeByMedia = new Map<number, any>();
  if (watchingMediaIds.length) {
    const { data: episodeEvents } = await supabase.from("watch_events").select("media_id,watched_at,episodes(episode_number,runtime,seasons(season_number))").eq("user_id", user.id).in("media_id", watchingMediaIds).not("episode_id", "is", null).order("watched_at", { ascending: false, nullsFirst: false });
    for (const event of episodeEvents ?? []) if (!latestEpisodeByMedia.has(event.media_id)) latestEpisodeByMedia.set(event.media_id, event);
  }

  const rawItems = rows.map(row => fromDbMedia(row.media));
  const items = await withCommunityRatings(rawItems, supabase);
  const filters = [
    { href: "/library", label: "Everything", active: !status && !favoritesMode },
    { href: "/library?status=planned", label: "Watchlist", active: status === "planned" && !favoritesMode },
    { href: "/library?status=watching", label: "Watching", active: status === "watching" && !favoritesMode },
    { href: "/library?status=completed", label: "Completed", active: status === "completed" && !favoritesMode },
    { href: "/library?status=paused", label: "Paused", active: status === "paused" && !favoritesMode },
    { href: "/library?status=dropped", label: "Dropped", active: status === "dropped" && !favoritesMode },
    { href: "/library?view=favorites", label: "Favorites", active: favoritesMode, icon: Heart }
  ];
  return <main className="page"><div className="shell">
    <div className="page-heading-row library-heading"><div><div className="eyebrow">Your screen life</div><h1 className="display page-title">My library</h1></div><Link className="button ghost" href="/lists"><ListIcon size={16} /> Your lists</Link></div>
    <nav className="filter-bar">{filters.map(filter => <Link className={`button small ${filter.active ? "accent" : "ghost"}`} href={filter.href} key={filter.href}>{filter.icon && <filter.icon size={14} />}{filter.label}</Link>)}</nav>
    {items.length ? <div className="media-grid">{items.map((item, index) => {
      const event = latestEpisodeByMedia.get(rows[index].media.id); const episode = Array.isArray(event?.episodes) ? event.episodes[0] : event?.episodes; const season = Array.isArray(episode?.seasons) ? episode.seasons[0] : episode?.seasons;
      const progressLabel = event ? `Last watched · S${season?.season_number ?? "?"} E${episode?.episode_number ?? "?"}${episode?.runtime ? ` · ${episode.runtime} min` : ""}` : rows[index].status === "watching" && item.kind === "show" ? "No episode watched yet" : undefined;
      return <MediaCard key={`${item.kind}-${item.id}`} item={item} progressLabel={progressLabel} />;
    })}</div> : <div className="empty-state"><h2 className="display">Nothing here yet</h2><p className="muted">{favoritesMode ? "Favorite a title and it will appear here." : "When you track a title, it will settle in here."}</p><Link className="button accent" href="/discover">Discover something</Link></div>}
  </div></main>;
}
