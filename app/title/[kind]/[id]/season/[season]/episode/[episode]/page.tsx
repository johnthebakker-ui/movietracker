import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { notFound } from "next/navigation";
import { TargetRatingBar, TargetReviewSections } from "@/components/target-feedback";
import { TitleMedia } from "@/components/title-media";
import { WatchLogForm } from "@/components/watch-log-form";
import { ensureMedia, ensureSeason } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEpisode, getMedia, getSeason, imageUrl } from "@/lib/tmdb";
import { getExternalRatings } from "@/lib/external-ratings";

export default async function EpisodePage({ params }: { params: Promise<{ kind: string; id: string; season: string; episode: string }> }) {
  const values = await params;
  if (values.kind !== "show") notFound();
  const showId = Number(values.id); const seasonNumber = Number(values.season); const episodeNumber = Number(values.episode);
  if (![showId, seasonNumber, episodeNumber].every(Number.isFinite)) notFound();
  const [show, season, episode] = await Promise.all([getMedia("show", showId), getSeason(showId, seasonNumber), getEpisode(showId, seasonNumber, episodeNumber)]);
  const externalRatings = await getExternalRatings(episode.externalIds?.imdb_id);
  let mediaId: number | null = null; let episodeId: number | null = null;
  try { mediaId = await ensureMedia(show); if (mediaId) { const seasonId = await ensureSeason(mediaId, season); const supabase = await createSupabaseServerClient(); if (supabase && seasonId) episodeId = (await supabase.from("episodes").select("id").eq("season_id", seasonId).eq("episode_number", episodeNumber).maybeSingle()).data?.id ?? null; } } catch (error) { console.error(error); }
  const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  let reviews: any[] = []; let communityRating: number | null = null; let userRating: number | null = null; let watched = false;
  if (supabase && episodeId) {
    const [{ data: reviewRows }, { data: ratingRows }, watch] = await Promise.all([
      supabase.from("reviews").select("id,title,body,contains_spoilers,created_at,rating_id,profiles(username,display_name),ratings(score)").eq("episode_id", episodeId).order("created_at", { ascending: false }).limit(20),
      supabase.from("ratings").select("score,user_id").eq("episode_id", episodeId),
      user ? supabase.from("watch_events").select("id").eq("user_id", user.id).eq("episode_id", episodeId).limit(1).maybeSingle() : Promise.resolve({ data: null }) as any
    ]);
    reviews = reviewRows ?? []; communityRating = ratingRows?.length ? ratingRows.reduce((sum, row) => sum + Number(row.score), 0) / ratingRows.length : null; userRating = user ? Number(ratingRows?.find(row => row.user_id === user.id)?.score ?? 0) || null : null; watched = Boolean(watch.data);
  }
  const path = `/title/show/${showId}/season/${seasonNumber}/episode/${episodeNumber}`;
  const artwork = imageUrl(episode.stillPath ?? show.backdropPath, "original");
  return <main className="page episode-detail-page">
    <header className="episode-detail-hero">{artwork && <Image src={artwork} alt="" fill priority sizes="100vw" />}<div className="shell episode-detail-copy"><Link className="text-link" href={`/title/show/${showId}/season/${seasonNumber}`}>← {show.title} · {season.name}</Link><div className="eyebrow">Season {seasonNumber} · Episode {episodeNumber}</div><h1 className="display">{episode.name}</h1><div className="episode-facts"><span>{episode.airDate ?? "Air date TBA"}</span>{episode.runtime && <span><Clock3 size={14} /> {episode.runtime} min</span>}{episode.voteAverage > 0 && <span>{episode.voteAverage.toFixed(1)}/10 TMDB</span>}</div><p className="overview">{episode.overview || "No description has been released for this episode yet."}</p>{user && mediaId && episodeId ? <WatchLogForm mediaId={mediaId} episodeId={episodeId} releaseDate={episode.airDate} path={path} watched={watched} /> : <Link className="button accent" href="/login">Sign in to track</Link>}</div></header>
    <div className="shell">{episodeId && <TargetRatingBar targetType="episode" targetId={episodeId} path={path} signedIn={Boolean(user)} rating={communityRating} userRating={userRating} sources={[...(episode.voteAverage ? [{ source: "TMDB", value: `${episode.voteAverage.toFixed(1)}/10` }] : []), ...externalRatings]} />}<TitleMedia videos={episode.videos ?? []} images={episode.images ?? []} />
      {(episode.cast?.length ?? 0) > 0 && <section className="section"><div className="section-head"><div><div className="eyebrow">Guest stars & cast</div><h2 className="display">In this episode</h2></div></div><div className="people-grid">{episode.cast!.slice(0, 12).map(person => <Link className="person-card" href={`/person/${person.id}`} key={`${person.id}-${person.character ?? "cast"}`}>{person.profile_path ? <Image src={imageUrl(person.profile_path, "w300")!} width={240} height={300} alt="" /> : <div className="person-placeholder" />}<strong>{person.name}</strong><span>{person.character}</span></Link>)}</div></section>}
      {episodeId && <TargetReviewSections targetType="episode" targetId={episodeId} path={path} signedIn={Boolean(user)} userRating={userRating} reviews={reviews} />}
    </div>
  </main>;
}
