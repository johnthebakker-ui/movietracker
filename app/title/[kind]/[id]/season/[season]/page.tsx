import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { BulkWatchLogForm } from "@/components/bulk-watch-log-form";
import { TargetRatingBar, TargetReviewSections } from "@/components/target-feedback";
import { TitleMedia } from "@/components/title-media";
import { WatchLogForm } from "@/components/watch-log-form";
import { ensureMedia, ensureSeason } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMedia, getSeason, imageUrl } from "@/lib/tmdb";
import { getOmdbSeasonRatings } from "@/lib/external-ratings";

export default async function SeasonPage({ params }: { params: Promise<{ kind: string; id: string; season: string }> }) {
  const { kind, id, season: seasonParam } = await params;
  if (kind !== "show") notFound();
  const [show, season] = await Promise.all([getMedia("show", Number(id)), getSeason(Number(id), Number(seasonParam))]);
  const omdbEpisodes = await getOmdbSeasonRatings((show.raw as any).external_ids?.imdb_id, season.seasonNumber); const imdbScores = omdbEpisodes.map(episode => episode.imdbRating).filter((score): score is number => score !== null); const tmdbScore = season.episodes.length ? season.episodes.reduce((sum, episode) => sum + episode.voteAverage, 0) / season.episodes.length : 0;
  let mediaId: number | null = null; let seasonId: number | null = null;
  try { mediaId = await ensureMedia(show); if (mediaId) seasonId = await ensureSeason(mediaId, season); } catch (error) { console.error(error); }
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  let episodeMap = new Map<number, number>(); let watched = new Set<number>(); let reviews: any[] = []; let communityRating: number | null = null; let userRating: number | null = null;
  if (supabase && seasonId) {
    const [{ data: episodes }, { data: reviewRows }, { data: ratingRows }] = await Promise.all([
      supabase.from("episodes").select("id,tmdb_id").eq("season_id", seasonId),
      supabase.from("reviews").select("id,title,body,contains_spoilers,created_at,rating_id,profiles(username,display_name),ratings(score)").eq("season_id", seasonId).order("created_at", { ascending: false }).limit(20),
      supabase.from("ratings").select("score,user_id").eq("season_id", seasonId)
    ]);
    episodeMap = new Map((episodes ?? []).map(episode => [episode.tmdb_id, episode.id])); reviews = reviewRows ?? [];
    communityRating = ratingRows?.length ? ratingRows.reduce((sum, row) => sum + Number(row.score), 0) / ratingRows.length : null; userRating = user ? Number(ratingRows?.find(row => row.user_id === user.id)?.score ?? 0) || null : null;
    const episodeIds = (episodes ?? []).map(episode => episode.id);
    if (user && episodeIds.length) { const { data } = await supabase.from("watch_events").select("episode_id").eq("user_id", user.id).in("episode_id", episodeIds); watched = new Set((data ?? []).map(event => event.episode_id)); }
  }
  const path = `/title/show/${id}/season/${season.seasonNumber}`;
  const seasonEpisodeIds = season.episodes.map(episode => episodeMap.get(episode.id)).filter((value): value is number => Boolean(value));
  const seasonEpisodeDates = Object.fromEntries(season.episodes.map(episode => [String(episodeMap.get(episode.id) ?? ""), episode.airDate]).filter(([key]) => key));
  return <main className="page"><div className="shell">
    <Link className="text-link" href={`/title/show/${id}`}>← Back to {show.title}</Link>
    <header className="season-hero">{season.posterPath && <Image src={imageUrl(season.posterPath, "w500")!} width={240} height={360} alt={`${season.name} poster`} priority />}<div><div className="eyebrow">{show.title} · {season.airDate?.slice(0, 4) ?? "Year TBA"}</div><h1 className="display">{season.name}</h1><div className="season-meta"><span>{season.episodeCount} episodes</span>{season.episodes.some(episode => episode.voteAverage) && <span>{(season.episodes.reduce((sum, episode) => sum + episode.voteAverage, 0) / Math.max(1, season.episodes.length)).toFixed(1)}/10 TMDB</span>}</div>{season.overview && <p className="overview">{season.overview}</p>}{user && mediaId && episodeMap.size > 0 && <BulkWatchLogForm mediaId={mediaId} episodeIds={seasonEpisodeIds} episodeDates={seasonEpisodeDates} path={path} label="Mark whole season watched" scope="season" />}</div></header>
    {seasonId && <TargetRatingBar targetType="season" targetId={seasonId} path={path} signedIn={Boolean(user)} rating={communityRating} userRating={userRating} sources={[...(tmdbScore ? [{ source: "TMDB", value: `${tmdbScore.toFixed(1)}/10` }] : []), ...(imdbScores.length ? [{ source: "IMDb", value: `${(imdbScores.reduce((sum, score) => sum + score, 0) / imdbScores.length).toFixed(1)}/10` }] : [])]} />}
    <TitleMedia videos={season.videos} images={season.images.posters} />
    <section className="section"><div className="section-head"><div><div className="eyebrow">The complete run</div><h2 className="display">Episodes</h2></div><Link className="text-link" href={`/title/show/${id}/episodes#season-${season.seasonNumber}`}>All seasons & rating table →</Link></div><div className="episode-list">{season.episodes.map((episode, index) => {
      const dbId = episodeMap.get(episode.id); const isWatched = dbId ? watched.has(dbId) : false; const through = season.episodes.slice(0, index + 1).map(item => episodeMap.get(item.id)).filter(Boolean).join(","); const episodeHref = `${path}/episode/${episode.episodeNumber}`;
      const throughIds = through.split(",").map(Number).filter(Boolean); const throughDates = Object.fromEntries(season.episodes.slice(0, index + 1).map(item => [String(episodeMap.get(item.id) ?? ""), item.airDate]).filter(([key]) => key));
      return <article className="episode" id={`episode-${episode.episodeNumber}`} key={episode.id}><Link className="episode-main-link" href={episodeHref}>{episode.stillPath ? <Image className="episode-still" src={imageUrl(episode.stillPath, "w500")!} alt="" width={440} height={248} /> : <div className="episode-still" />}<div><div className="eyebrow">Episode {episode.episodeNumber}</div><h3>{episode.name}</h3><p className="overview">{episode.overview || "No description has been released yet."}</p><div className="muted episode-meta">{episode.airDate ?? "Air date TBA"} · {episode.runtime ? `${episode.runtime} min` : "Runtime TBA"} {episode.voteAverage > 0 && <>· ★ {episode.voteAverage.toFixed(1)}</>}</div></div><ChevronRight className="episode-chevron" /></Link>{user && mediaId && dbId ? <div className="episode-watch-actions"><WatchLogForm mediaId={mediaId} episodeId={dbId} releaseDate={episode.airDate} path={path} watched={isWatched} /><BulkWatchLogForm mediaId={mediaId} episodeIds={throughIds} episodeDates={throughDates} path={path} label="Watch through here" scope="season" /></div> : <Link className="button ghost" href="/login">Sign in to track</Link>}</article>;
    })}</div></section>
    {seasonId && <TargetReviewSections targetType="season" targetId={seasonId} path={path} signedIn={Boolean(user)} userRating={userRating} reviews={reviews} />}
  </div></main>;
}
