import type { MediaSummary } from "@/lib/types";
export function fromDbMedia(row:any):MediaSummary{return {id:row.tmdb_id,kind:row.kind,title:row.title,overview:row.overview??'',posterPath:row.poster_path,backdropPath:row.backdrop_path,releaseDate:row.release_date,voteAverage:Number(row.vote_average??0),voteCount:row.vote_count??0,popularity:Number(row.popularity??0),genres:row.genres??[]}}
