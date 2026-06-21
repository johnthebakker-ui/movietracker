import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookmarkPlus, Check, CirclePause, CircleX, Eye, Heart, Play, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { setProgress, toggleFavorite } from "@/app/actions/library";
import { AddToListForm } from "@/components/add-to-list-form";
import { BulkWatchLogForm } from "@/components/bulk-watch-log-form";
import { TitleMedia } from "@/components/title-media";
import { MediaSection } from "@/components/media-section";
import { WatchLogForm } from "@/components/watch-log-form";
import { TitleRatingPicker } from "@/components/title-rating-picker";
import { ReviewComposer } from "@/components/review-composer";
import { ReviewCard } from "@/components/review-card";
import { ensureMedia } from "@/lib/catalog";
import { getExternalRatings } from "@/lib/external-ratings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMedia, imageUrl } from "@/lib/tmdb";
import type { MediaKind } from "@/lib/types";
import { minutesToLabel, yearOf } from "@/lib/utils";
import { withCommunityRatings } from "@/lib/community-ratings";

type Props = { params: Promise<{ kind: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, id } = await params;
  if (!['movie','show'].includes(kind)) return {};
  try { const item = await getMedia(kind as MediaKind, Number(id)); return { title: item.title, description: item.overview }; } catch { return {}; }
}

export default async function TitlePage({ params }: Props) {
  const { kind: rawKind, id: rawId } = await params;
  if (!['movie','show'].includes(rawKind) || !Number.isFinite(Number(rawId))) notFound();
  const kind = rawKind as MediaKind;
  const item = await getMedia(kind, Number(rawId));
  let mediaId: number | null = null;
  try { mediaId = await ensureMedia(item); } catch (error) { console.error("Catalog hydration failed", error); }
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const externalRatings = await getExternalRatings((item.raw as any).external_ids?.imdb_id);
  let state: any = null, rating: any = null, favorite = false, lists: any[] = [], watched = false, reviews: any[] = [], communityScore: number | null = null;
  if (supabase && mediaId) {
    const reviewQuery = supabase.from("reviews").select("id,title,body,contains_spoilers,created_at,user_id,rating_id,profiles(username,display_name,avatar_url),ratings(score)").eq("media_id", mediaId).order("created_at", { ascending: false }).limit(20);
    const calls: any[] = [reviewQuery, supabase.from("ratings").select("score").eq("media_id", mediaId)];
    if (user) calls.push(
      supabase.from("progress").select("status").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
      supabase.from("ratings").select("score").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
      supabase.from("favorites").select("media_id").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
      supabase.from("lists").select("id,name").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("watch_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("media_id", mediaId).is("episode_id", null)
    );
    const results = await Promise.all(calls);
    reviews = results[0].data ?? []; const communityRatings = results[1].data ?? []; communityScore = communityRatings.length ? communityRatings.reduce((sum: number, row: any) => sum + Number(row.score), 0) / communityRatings.length : null;
    if (user) { state = results[2].data; rating = results[3].data; favorite = Boolean(results[4].data); lists = results[5].data ?? []; watched = Boolean(results[6].count); }
  }
  const ratedRecommendations = await withCommunityRatings(item.recommendations, supabase);
  const path = `/title/${kind}/${item.id}`;
  const backdrop = imageUrl(item.backdropPath, "original");
  const poster = imageUrl(item.posterPath, "w500");
  const director = item.crew.find((x) => x.job === "Director" || x.job === "Creator");
  const statusOptions = [{ value: "planned", label: "Plan", icon: BookmarkPlus }, { value: "watching", label: "Watching", icon: Eye }, { value: "completed", label: "Watched", icon: Check }, { value: "paused", label: "Paused", icon: CirclePause }, { value: "dropped", label: "Dropped", icon: CircleX }] as const;
  return <main className="page">
    <section className="detail-hero">
      {backdrop && <Image className="detail-bg" src={backdrop} alt="" fill priority sizes="100vw" />}
      <div className="shell detail-layout">
        {poster && <Image className="detail-poster" src={poster} width={440} height={660} alt={`${item.title} poster`} priority />}
        <div className="detail-copy"><div className="eyebrow">{kind === "movie" ? "Film" : "Television series"}</div><h1 className="display">{item.title}</h1>
          <div className="meta-line"><span>{yearOf(item.releaseDate)}</span><span>{minutesToLabel(item.runtime)}</span><span>{item.status}</span></div>
          <div className="rating-source-row"><div><small>MovieTracker</small><strong><Star size={14} fill="currentColor" /> {communityScore?.toFixed(1) ?? "—"}<em>/10</em></strong></div><div><small>TMDB</small><strong>{item.voteAverage.toFixed(1)}<em>/10</em></strong></div>{externalRatings.map(source => <div key={source.source}><small>{source.source}</small><strong>{source.value}</strong></div>)}</div>
          {item.tagline && <p className="tagline">“{item.tagline}”</p>}<p className="overview">{item.overview}</p>
          {item.videos[0] && <a className="button accent" href="#trailer"><Play size={16} fill="currentColor" /> View trailer</a>}
        </div>
      </div>
    </section>
    <div className="shell">
      <section className="title-action-dock">
        <div className="tracking-control"><div className="action-label"><span>My status</span><small>Keep your library current</small></div>
          {mediaId && user ? <div className="status-actions">{statusOptions.map(({ value, label, icon: Icon }) => <form action={setProgress} key={value}><input type="hidden" name="mediaId" value={mediaId} /><input type="hidden" name="status" value={value} /><input type="hidden" name="path" value={path} /><button className={state?.status === value ? "active" : ""} aria-pressed={state?.status === value}><Icon size={16} />{label}</button></form>)}</div> : <Link className="track-sign-in" href="/login">Sign in to start tracking →</Link>}
        </div>
        <TitleRatingPicker mediaId={mediaId} path={path} rating={rating?.score} signedIn={Boolean(user)} />
        {mediaId && user && <div className="title-quick-actions">
        <form action={toggleFavorite}><input type="hidden" name="mediaId" value={mediaId}/><input type="hidden" name="path" value={path}/><button className="button ghost"><Heart size={16} fill={favorite ? "currentColor" : "none"}/>{favorite ? "Favorited" : "Favorite"}</button></form>
        {kind === "movie" ? <WatchLogForm mediaId={mediaId} releaseDate={item.releaseDate} path={path} watched={watched} /> : <BulkWatchLogForm mediaId={mediaId} tmdbId={item.id} path={path} label="Mark entire series watched" scope="show" />}
        {lists.length > 0 && <AddToListForm mediaId={mediaId} path={path} lists={lists} />}
        </div>}
      </section>
      <section className="facts"><div className="fact"><small>Released</small><strong>{item.releaseDate || "TBA"}</strong></div><div className="fact"><small>{director?.job ?? "Director"}</small><strong>{director?.name ?? "TBA"}</strong></div><div className="fact"><small>Original language</small><strong>{item.originalLanguage.toUpperCase()}</strong></div><div className="fact"><small>Genres</small><strong>{item.genres.map(g=>g.name).join(", ")}</strong></div></section>
      {kind === "show" && item.seasons.length > 0 && <section className="section seasons-prominent"><div className="section-head"><div><div className="eyebrow">The full story</div><h2 className="display">Seasons & episodes</h2></div><Link className="text-link" href={`${path}/episodes`}>All episodes & ratings →</Link></div><div className="season-list">{item.seasons.map((season)=><Link className="season-card" href={`${path}/season/${season.seasonNumber}`} key={season.id}>{season.posterPath && <Image src={imageUrl(season.posterPath,"w185")!} width={116} height={174} alt=""/>}<div><strong>{season.name}</strong><div className="muted" style={{fontSize:'.78rem',marginTop:6}}>{season.episodeCount} episodes · {yearOf(season.airDate)}</div></div></Link>)}</div></section>}
      <TitleMedia videos={item.videos} images={item.images.backdrops} />
      {item.cast.length > 0 && <section className="section"><div className="section-head"><div><div className="eyebrow">In front of the camera</div><h2 className="display">Cast</h2></div></div><div className="people-grid">{item.cast.slice(0,12).map((person)=><Link className="person-card" href={`/person/${person.id}`} key={`${person.id}-${person.character}`}><div>{person.profile_path ? <Image className="person-photo" src={imageUrl(person.profile_path,"w185")!} alt="" width={185} height={185}/> : <div className="person-photo"/>}</div><div className="person-name">{person.name}</div><div className="person-role truncate">{person.character}</div></Link>)}</div></section>}
      {item.companies.length > 0 && <section className="section"><div className="section-head"><div><div className="eyebrow">Behind the production</div><h2 className="display">Studios & companies</h2></div></div><div className="company-grid">{item.companies.map(company => <Link className="company-chip" href={`/company/${company.id}`} key={company.id}><div className="company-chip-logo">{company.logo_path ? <Image src={imageUrl(company.logo_path,"w185")!} width={120} height={64} alt="" /> : <span>{company.name.slice(0,1)}</span>}</div><strong>{company.name}</strong></Link>)}</div></section>}
      {mediaId && user && <section className="section review-section"><div className="section-head"><div><div className="eyebrow">Your take</div><h2 className="display">Write a review</h2></div><p>One score, one opinion. Changing it here also updates your rating above.</p></div><ReviewComposer targetType="media" targetId={mediaId} path={path} currentRating={rating?.score} /></section>}
      <section className="section"><div className="section-head"><div><div className="eyebrow">From the community</div><h2 className="display">Reviews</h2></div></div>{reviews.length ? <div className="review-grid">{reviews.map((review)=><ReviewCard review={review} key={review.id} />)}</div> : <div className="empty-state"><h2 className="display">No reviews yet</h2><p className="muted">The opening line could be yours.</p></div>}</section>
      {ratedRecommendations.length > 0 && <MediaSection eyebrow="If this stayed with you" title="More like this" items={ratedRecommendations}/>}
    </div>
  </main>;
}
