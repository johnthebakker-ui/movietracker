import Image from "@/components/app-image";
import Link from "next/link";
import { MessageSquareText, Star } from "lucide-react";
import { imageUrl } from "@/lib/tmdb";

type RelatedMedia = { tmdb_id?: number | null; kind?: "movie" | "show" | null; title?: string | null; poster_path?: string | null; backdrop_path?: string | null };
type RelatedSeason = { season_number?: number | null; name?: string | null; poster_path?: string | null; media?: RelatedMedia | RelatedMedia[] | null };
type RelatedEpisode = { name?: string | null; episode_number?: number | null; still_path?: string | null; seasons?: RelatedSeason | RelatedSeason[] | null };
type Rating = { score?: number | string | null };
export type UserReview = {
  id: string;
  title?: string | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
  updated_at?: string | null;
  media?: RelatedMedia | RelatedMedia[] | null;
  seasons?: RelatedSeason | RelatedSeason[] | null;
  episodes?: RelatedEpisode | RelatedEpisode[] | null;
  ratings?: Rating | Rating[] | null;
};

function single<T>(value?: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

function reviewTarget(review: UserReview) {
  const media = single(review.media);
  if (media?.tmdb_id && media.kind) {
    return {
      href: `/title/${media.kind}/${media.tmdb_id}`,
      eyebrow: media.kind === "show" ? "Series review" : "Film review",
      title: media.title ?? "Untitled",
      subtitle: media.kind === "show" ? "Show" : "Movie",
      artwork: imageUrl(media.poster_path ?? media.backdrop_path, "w342")
    };
  }

  const season = single(review.seasons);
  const seasonMedia = single(season?.media);
  if (season?.season_number != null && seasonMedia?.tmdb_id) {
    return {
      href: `/title/show/${seasonMedia.tmdb_id}/season/${season.season_number}`,
      eyebrow: "Season review",
      title: seasonMedia.title ?? "Untitled show",
      subtitle: `Season ${season.season_number}${season.name ? ` - ${season.name}` : ""}`,
      artwork: imageUrl(season.poster_path ?? seasonMedia.poster_path ?? seasonMedia.backdrop_path, "w342")
    };
  }

  const episode = single(review.episodes);
  const episodeSeason = single(episode?.seasons);
  const episodeMedia = single(episodeSeason?.media);
  if (episode?.episode_number != null && episodeSeason?.season_number != null && episodeMedia?.tmdb_id) {
    return {
      href: `/title/show/${episodeMedia.tmdb_id}/season/${episodeSeason.season_number}/episode/${episode.episode_number}`,
      eyebrow: "Episode review",
      title: episodeMedia.title ?? "Untitled show",
      subtitle: `S${episodeSeason.season_number} E${episode.episode_number}${episode.name ? ` - ${episode.name}` : ""}`,
      artwork: imageUrl(episode.still_path ?? episodeMedia.backdrop_path ?? episodeMedia.poster_path, "w500")
    };
  }

  return { href: "/library", eyebrow: "Review", title: "Saved review", subtitle: "Open your library", artwork: null };
}

export function UserReviewList({ reviews, compact = false }: { reviews: UserReview[]; compact?: boolean }) {
  return <div className={`user-review-list${compact ? " compact" : ""}`}>
    {reviews.map(review => {
      const target = reviewTarget(review);
      const rating = single(review.ratings);
      const score = Number(rating?.score);
      const edited = review.updated_at && new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 1000;
      return <Link className="user-review-card" href={target.href} key={review.id}>
        <div className="user-review-art">{target.artwork ? <Image src={target.artwork} alt="" fill sizes={compact ? "120px" : "180px"} /> : <MessageSquareText size={22} />}</div>
        <div className="user-review-copy">
          <div className="user-review-kicker"><span>{target.eyebrow}</span>{Number.isFinite(score) && <strong><Star size={12} fill="currentColor" /> {score.toFixed(1)}</strong>}</div>
          <h3>{target.title}</h3>
          <small>{target.subtitle} - {new Date(review.created_at).toLocaleDateString()}{edited ? " - edited" : ""}</small>
          {review.title && <b>{review.title}</b>}
          <p>{review.contains_spoilers ? "This review contains spoilers." : review.body}</p>
        </div>
      </Link>;
    })}
  </div>;
}
