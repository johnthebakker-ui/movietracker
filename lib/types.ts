export type MediaKind = "movie" | "show";

export interface Genre { id: number; name: string }
export interface PersonCredit {
  id: number;
  name: string;
  character?: string;
  job?: string;
  profile_path?: string | null;
}
export interface Video { id: string; key: string; name: string; site: string; type: string; official?: boolean }

export interface MediaSummary {
  id: number;
  kind: MediaKind;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number;
  voteCount: number;
  communityRating?: number | null;
  communityRatingCount?: number;
  popularity: number;
  genres: Genre[];
  collectionTmdbId?: number | null;
  collectionName?: string | null;
  collectionPosterPath?: string | null;
}

export interface SeasonSummary {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  airDate: string | null;
  episodeCount: number;
}

export interface MediaDetail extends MediaSummary {
  originalTitle: string;
  tagline: string;
  runtime: number | null;
  status: string;
  originalLanguage: string;
  countries: string[];
  cast: PersonCredit[];
  crew: PersonCredit[];
  companies: { id: number; name: string; logo_path?: string | null }[];
  videos: Video[];
  seasons: SeasonSummary[];
  numberOfEpisodes?: number;
  numberOfSeasons?: number;
  recommendations: MediaSummary[];
  images: { backdrops: { filePath: string; width: number; height: number }[]; posters: { filePath: string; width: number; height: number }[] };
  raw: Record<string, unknown>;
}

export interface EpisodeDetail {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string | null;
  runtime: number | null;
  voteAverage: number;
  voteCount?: number;
  videos?: Video[];
  images?: { filePath: string; width: number; height: number }[];
  cast?: PersonCredit[];
  crew?: PersonCredit[];
  externalIds?: Record<string, string | null>;
}

export interface SeasonDetail extends SeasonSummary {
  episodes: EpisodeDetail[];
  videos: Video[];
  images: { posters: { filePath: string; width: number; height: number }[] };
  cast: PersonCredit[];
}
