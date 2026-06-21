import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Film, Flame, History, List, MapPin, PauseCircle, Settings, Star, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { followUser, unfollowUser } from "@/app/actions/social";
import { MediaCard } from "@/components/media-card";
import { ListCardArt } from "@/components/list-card-art";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fromDbMedia } from "@/lib/db-mappers";
import { imageUrl } from "@/lib/tmdb";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: profile } = await supabase.from("profiles").select("*,privacy_settings(*)").eq("username", username).maybeSingle();
  if (!profile) notFound();
  const viewer = (await supabase.auth.getUser()).data.user;
  const isOwner = viewer?.id === profile.id;
  const [followers, following, progressCount, progressStatuses, ratings, favorites, lists, listCount, history, streakEvents, watchCount, relationship] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id).eq("status", "accepted"),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id).eq("status", "accepted"),
    supabase.from("progress").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("progress").select("status,updated_at,media(*)").eq("user_id", profile.id).order("updated_at", { ascending: false }).limit(500),
    supabase.from("ratings").select("score").eq("user_id", profile.id),
    supabase.from("favorites").select("media(*)").eq("user_id", profile.id).order("position").limit(12),
    supabase.from("lists").select("id,name,description,visibility,updated_at,cover_url,featured_media_id,list_items(position,media(id,tmdb_id,kind,title,poster_path,backdrop_path))").eq("user_id", profile.id).order("updated_at", { ascending: false }),
    supabase.from("lists").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("watch_events").select("id,watched_at,episode_id,media(tmdb_id,kind,title,backdrop_path,poster_path),episodes(name,episode_number,still_path,seasons(season_number))").eq("user_id", profile.id).order("watched_at", { ascending: false, nullsFirst: false }).limit(8),
    supabase.from("watch_events").select("watched_at").eq("user_id", profile.id).not("watched_at", "is", null).order("watched_at", { ascending: false }).limit(1000),
    supabase.from("watch_events").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    viewer && !isOwner ? supabase.from("follows").select("status").eq("follower_id", viewer.id).eq("following_id", profile.id).maybeSingle() : Promise.resolve({ data: null }) as any
  ]);
  const privateProfile = profile.privacy_settings?.profile === "private";
  const statusRows = progressStatuses.data ?? [];
  const currentlyWatching = statusRows.filter((row: any) => row.status === "watching" || row.status === "paused").map((row: any) => ({ status: row.status, updatedAt: row.updated_at, item: row.media ? fromDbMedia(row.media) : null })).filter(row => row.item);
  const progressGroups = [
    { key: "completed", label: "Completed", icon: CheckCircle2, rows: statusRows.filter((row: any) => row.status === "completed") },
    { key: "active", label: "In progress", icon: PauseCircle, rows: statusRows.filter((row: any) => row.status === "watching" || row.status === "paused") },
    { key: "dropped", label: "Dropped", icon: XCircle, rows: statusRows.filter((row: any) => row.status === "dropped") }
  ];
  const watchedDays = [...new Set((streakEvents.data ?? []).filter((event: any) => event.watched_at).map((event: any) => event.watched_at.slice(0, 10)))].sort().reverse();
  let currentStreak = 0; let longestStreak = 0; let running = 0; let previousDay: number | null = null;
  for (const day of [...watchedDays].reverse()) { const value = new Date(`${day}T12:00:00Z`).getTime(); running = previousDay !== null && value - previousDay === 86400000 ? running + 1 : 1; longestStreak = Math.max(longestStreak, running); previousDay = value; }
  if (watchedDays.length) { const cursor = new Date(); cursor.setUTCHours(0, 0, 0, 0); const latest = new Date(`${watchedDays[0]}T00:00:00Z`); if ((cursor.getTime() - latest.getTime()) / 86400000 <= 1) { for (const day of watchedDays) { const expected = cursor.toISOString().slice(0, 10); const yesterday = new Date(cursor.getTime() - 86400000).toISOString().slice(0, 10); if (day === expected || (currentStreak === 0 && day === yesterday)) { currentStreak++; cursor.setUTCDate(cursor.getUTCDate() - (day === expected ? 1 : 2)); } else break; } } }
  const favoriteItems = (favorites.data ?? []).map((row: any) => row.media).filter(Boolean).map(fromDbMedia);
  const averageRating = ratings.data?.length ? (ratings.data.reduce((sum, row) => sum + Number(row.score), 0) / ratings.data.length).toFixed(1) : "—";
  const memberSince = new Date(profile.created_at).toLocaleDateString("en", { month: "long", year: "numeric" });
  return <main className="page profile-page"><div className="shell">
    <section className="profile-hero-premium">
      <div className="profile-cover" style={profile.banner_url ? { backgroundImage: `linear-gradient(0deg, rgba(8,9,10,.72), transparent 70%), url(${profile.banner_url})` } : undefined} />
      <div className="profile-identity">
        <Image className="profile-avatar-large" src={profile.avatar_url || "/default-avatar.svg"} width={132} height={132} alt="" priority />
        <div className="profile-name-block"><div className="eyebrow">Member since {memberSince}</div><h1 className="display">{profile.display_name || profile.username}</h1><div className="profile-handle"><span>@{profile.username}</span><span>{followers.count ?? 0} followers</span><span>{following.count ?? 0} following</span></div>{profile.bio && <p>{profile.bio}</p>}<div className="profile-location"><MapPin size={13} /> {profile.region}</div></div>
        <div className="profile-actions">{isOwner ? <Link className="button ghost" href="/settings/profile"><Settings size={16} /> Edit profile</Link> : viewer && <form action={relationship.data ? unfollowUser : followUser}><input type="hidden" name="userId" value={profile.id} /><input type="hidden" name="username" value={profile.username} /><input type="hidden" name="private" value={String(privateProfile)} /><button className="button accent">{relationship.data?.status === "pending" ? "Requested" : relationship.data ? "Following" : privateProfile ? "Request follow" : "Follow"}</button></form>}</div>
      </div>
      <nav className="profile-nav"><a href="#overview">Overview</a><a href="#activity">Activity</a><a href="#lists">Lists</a>{isOwner && <><Link href="/history">Full history</Link><Link href="/stats">Statistics</Link></>}</nav>
    </section>

    <section className="profile-stat-band" id="overview">
      <div><Film size={17} /><strong>{progressCount.count ?? 0}</strong><span>tracked titles</span></div>
      <div><History size={17} /><strong>{watchCount.count ?? 0}</strong><span>watch events</span></div>
      <div><Star size={17} /><strong>{averageRating}</strong><span>average rating</span></div>
      <div><List size={17} /><strong>{listCount.count ?? 0}</strong><span>lists</span></div>
    </section>

    {(history.data?.length ?? 0) > 0 && <section className="section" id="activity"><div className="section-head"><div><div className="eyebrow">A dated viewing diary</div><h2 className="display">Recent history</h2></div>{isOwner && <Link className="text-link" href="/history">See complete history →</Link>}</div><div className="profile-history-grid">{(history.data ?? []).slice(0, 6).map((event: any) => {
      const media = event.media; const episode = event.episodes; const season = Array.isArray(episode?.seasons) ? episode.seasons[0] : episode?.seasons; const art = imageUrl(episode?.still_path ?? media?.backdrop_path ?? media?.poster_path, "w500");
      return <Link className="profile-history-card" href={`/title/${media?.kind}/${media?.tmdb_id}`} key={event.id}><div className="profile-history-art">{art && <Image src={art} alt="" fill sizes="360px" />}</div><div><span>{event.watched_at ? new Date(event.watched_at).toLocaleDateString("en", { day: "numeric", month: "short" }) : "Date unknown"}</span><strong>{media?.title}</strong><small>{episode ? `S${season?.season_number} E${episode.episode_number} · ${episode.name}` : "Movie watched"}</small></div></Link>;
    })}</div></section>}

    <section className="section"><div className="section-head"><div><div className="eyebrow">Your viewing momentum</div><h2 className="display">Progress</h2></div>{isOwner && <Link className="text-link" href="/library">Open library →</Link>}</div><div className="profile-progress-layout"><div className="progress-state-grid">{progressGroups.map(group => <Link className={`progress-state-card ${group.key}`} href={`/library?status=${group.key === "active" ? "watching" : group.key}`} key={group.key}><group.icon size={21} /><strong>{group.rows.length}</strong><span>{group.label}</span><div className="progress-mini-posters">{group.rows.slice(0, 4).map((row: any) => { const poster = imageUrl(row.media?.poster_path, "w185"); return poster ? <Image src={poster} alt="" width={36} height={54} key={row.media?.id} /> : null; })}</div></Link>)}</div><div className="streak-card"><Flame size={28} /><div><span>Current streak</span><strong>{currentStreak} {currentStreak === 1 ? "day" : "days"}</strong><small>Longest streak · {longestStreak} days</small></div></div></div>{currentlyWatching.length > 0 && <><div className="profile-subhead"><strong>Currently watching</strong><span>Only active and paused titles appear here.</span></div><div className="progress-recent-row">{currentlyWatching.slice(0, 8).map(row => <div className="tracked-card" key={`${row.item!.kind}-${row.item!.id}`}><MediaCard item={row.item!} /><span>{row.status} · updated {new Date(row.updatedAt).toLocaleDateString()}</span></div>)}</div></>}</section>

    {favoriteItems.length > 0 && <section className="section"><div className="section-head"><div><div className="eyebrow">Personal canon</div><h2 className="display">Favorites</h2></div></div><div className="media-grid">{favoriteItems.slice(0, 6).map(item => <MediaCard item={item} key={`${item.kind}-${item.id}`} />)}</div></section>}

    {(lists.data?.length ?? 0) > 0 && <section className="section" id="lists"><div className="section-head"><div><div className="eyebrow">Curated by {profile.display_name || profile.username}</div><h2 className="display">Lists</h2></div>{isOwner && <Link className="text-link" href="/lists">Manage lists →</Link>}</div><div className="profile-list-grid">{(lists.data ?? []).map((list: any) => {
      const listItems = [...(list.list_items ?? [])].sort((a: any, b: any) => a.position - b.position); const posters = listItems.map((item: any) => imageUrl(item.media?.poster_path, "w300")).filter((poster: string | null): poster is string => Boolean(poster)).slice(0, 4); const featured = listItems.find((item: any) => item.media?.id === list.featured_media_id)?.media; const featuredArt = imageUrl(featured?.backdrop_path || featured?.poster_path, "w780");
      return <Link className="profile-list-card" href={`/lists/${list.id}`} key={list.id}><ListCardArt customCover={list.cover_url} featuredArt={featuredArt} posters={posters} compact /><div className="profile-list-copy"><span className="eyebrow">{list.visibility}</span><h3>{list.name}</h3><p>{list.description || "A hand-picked collection."}</p><strong>{listItems.length} {listItems.length === 1 ? "title" : "titles"}</strong></div></Link>;
    })}</div></section>}

    {isOwner && <section className="profile-shortcuts"><Link href="/calendar"><CalendarDays size={20} /><div><strong>Episode calendar</strong><span>See what airs next</span></div></Link><Link href="/history"><History size={20} /><div><strong>Watch history</strong><span>Browse your complete diary</span></div></Link></section>}
  </div></main>;
}
