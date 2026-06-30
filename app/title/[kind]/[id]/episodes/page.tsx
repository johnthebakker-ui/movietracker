import Image from "@/components/app-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOmdbSeasonRatings } from "@/lib/external-ratings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMedia, getSeason, imageUrl } from "@/lib/tmdb";

type Source = "movietracker" | "imdb" | "tmdb";

export default async function AllEpisodesPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ source?: string }> }) {
  const { kind, id } = await params;
  const query = await searchParams;
  if (kind !== "show") notFound();
  const show = await getMedia("show", Number(id));
  const imdbId = (show.raw as any).external_ids?.imdb_id as string | undefined;
  const seasons = await Promise.all(show.seasons.map(summary => getSeason(show.id, summary.seasonNumber)));
  const omdbResults = await Promise.all(seasons.map(season => getOmdbSeasonRatings(imdbId, season.seasonNumber)));
  const imdbRatings = new Map<string, number>();
  seasons.forEach((season, index) => omdbResults[index].forEach(rating => {
    if (typeof rating.imdbRating === "number") imdbRatings.set(`${season.seasonNumber}-${rating.episode}`, rating.imdbRating);
  }));

  const movieTrackerRatings = await loadMovieTrackerEpisodeRatings(show.id);
  const source: Source = query.source === "movietracker" && movieTrackerRatings.size ? "movietracker" : query.source === "imdb" && imdbRatings.size ? "imdb" : "tmdb";
  const maxEpisodes = Math.max(0, ...seasons.map(season => season.episodes.length));
  const scoreFor = (seasonNumber: number, episodeNumber: number, tmdbScore: number) => {
    if (source === "movietracker") return movieTrackerRatings.get(`${seasonNumber}-${episodeNumber}`) ?? null;
    if (source === "imdb") return imdbRatings.get(`${seasonNumber}-${episodeNumber}`) ?? null;
    return tmdbScore > 0 ? tmdbScore : null;
  };
  const rated = seasons
    .flatMap(season => season.episodes.map(episode => ({ season: season.seasonNumber, episode, score: scoreFor(season.seasonNumber, episode.episodeNumber, episode.voteAverage) })))
    .filter(item => item.score != null)
    .sort((a, b) => Number(b.score) - Number(a.score));

  return <main className="page"><div className="shell">
    <Link className="text-link" href={`/title/show/${id}`}>Back to {show.title}</Link>
    <div className="episodes-page-heading"><div><div className="eyebrow">Every chapter, compared</div><h1 className="display">Episodes & ratings</h1><p className="overview">Browse every season, jump to an episode, or scan the rating table by source.</p></div>{show.posterPath && <Image src={imageUrl(show.posterPath, "w300")!} width={120} height={180} alt="" />}</div>
    <div className="rating-source-tabs">
      <SourceTab id={id} source="movietracker" label="MovieTracker" active={source === "movietracker"} available={movieTrackerRatings.size > 0} />
      <SourceTab id={id} source="imdb" label="IMDb" active={source === "imdb"} available={imdbRatings.size > 0} />
      <SourceTab id={id} source="tmdb" label="TMDB" active={source === "tmdb"} available />
      <span className="source-tab disabled">Rotten Tomatoes</span>
      <span className="source-tab disabled">Metacritic</span>
    </div>
    <section className="section compact-section"><div className="section-head"><div><div className="eyebrow">Highest audience scores</div><h2 className="display">Top-rated episodes</h2></div></div><div className="top-episode-grid">{rated.slice(0, 6).map(item => <Link href={`/title/show/${id}/season/${item.season}/episode/${item.episode.episodeNumber}`} key={`${item.season}-${item.episode.id}`}><span>Top rated</span><strong>S{item.season}.E{item.episode.episodeNumber} - {item.episode.name}</strong><small>{Number(item.score).toFixed(1)}/10 {sourceLabel(source)}</small></Link>)}</div></section>
    <section className="section compact-section"><div className="section-head"><div><div className="eyebrow">Season x episode</div><h2 className="display">Ratings table</h2></div></div><div className="episode-matrix-scroll"><table className="episode-matrix"><thead><tr><th>Season</th>{Array.from({ length: maxEpisodes }, (_, index) => <th key={index}>E{index + 1}</th>)}</tr></thead><tbody>{seasons.map(season => <tr key={season.id}><th><a href={`#season-${season.seasonNumber}`}>S{season.seasonNumber}</a></th>{Array.from({ length: maxEpisodes }, (_, index) => { const episode = season.episodes[index]; if (!episode) return <td className="empty" key={index} />; const score = scoreFor(season.seasonNumber, episode.episodeNumber, episode.voteAverage); return <td key={episode.id}><Link title={`${episode.name} - ${sourceLabel(source)}`} href={`/title/show/${id}/season/${season.seasonNumber}/episode/${episode.episodeNumber}`}>{score != null ? score.toFixed(1) : "-"}</Link></td>; })}</tr>)}</tbody></table></div></section>
    {seasons.map(season => <section className="section episode-browser-season" id={`season-${season.seasonNumber}`} key={season.id}><div className="section-head"><div><div className="eyebrow">{season.airDate?.slice(0, 4) ?? "Year TBA"}</div><h2 className="display">{season.name}</h2></div><Link className="text-link" href={`/title/show/${id}/season/${season.seasonNumber}`}>Season details</Link></div><div className="episode-browser-list">{season.episodes.map(episode => { const score = scoreFor(season.seasonNumber, episode.episodeNumber, episode.voteAverage); return <Link href={`/title/show/${id}/season/${season.seasonNumber}/episode/${episode.episodeNumber}`} key={episode.id}><div className="episode-browser-art">{episode.stillPath && <Image src={imageUrl(episode.stillPath, "w500")!} alt="" fill sizes="220px" />}</div><div><strong>S{season.seasonNumber}.E{episode.episodeNumber} - {episode.name}</strong><p>{episode.overview || "No description available."}</p><span>{episode.airDate ?? "TBA"} - {score != null ? `${score.toFixed(1)} ${sourceLabel(source)}` : "No score"}</span></div></Link>; })}</div></section>)}
  </div></main>;
}

function SourceTab({ id, source, label, active, available }: { id: string; source: Source; label: string; active: boolean; available: boolean }) {
  if (!available) return <span className="source-tab disabled">{label}</span>;
  return <Link className={`source-tab${active ? " active" : ""}`} href={`/title/show/${id}/episodes?source=${source}`}>{label}</Link>;
}

function sourceLabel(source: Source) {
  if (source === "movietracker") return "MovieTracker";
  if (source === "imdb") return "IMDb";
  return "TMDB";
}

async function loadMovieTrackerEpisodeRatings(tmdbId: number) {
  const supabase = await createSupabaseServerClient();
  const scores = new Map<string, number>();
  if (!supabase) return scores;
  const { data: media } = await supabase.from("media").select("id").eq("kind", "show").eq("tmdb_id", tmdbId).maybeSingle();
  if (!media?.id) return scores;
  const { data: seasons } = await supabase.from("seasons").select("season_number,episodes(id,episode_number,ratings(score))").eq("media_id", media.id);
  (seasons ?? []).forEach((season: any) => (season.episodes ?? []).forEach((episode: any) => {
    const ratings = episode.ratings ?? [];
    if (ratings.length) scores.set(`${season.season_number}-${episode.episode_number}`, ratings.reduce((sum: number, row: any) => sum + Number(row.score), 0) / ratings.length);
  }));
  return scores;
}
