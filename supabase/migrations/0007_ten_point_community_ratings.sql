-- Move MovieTracker ratings from half-star scores (0.5-5) to decimal scores (1.0-10.0).
-- Existing ratings are doubled so their meaning is preserved.
alter table public.ratings drop constraint if exists ratings_score_check;

alter table public.ratings
  alter column score type numeric(3,1)
  using round((score * 2)::numeric, 1);

alter table public.ratings
  add constraint ratings_score_check
  check (score between 1.0 and 10.0 and score = round(score, 1));

-- Poster badges expose only ratings whose owners made ratings public.
create or replace function public.get_media_community_ratings(p_tmdb_ids bigint[])
returns table (
  tmdb_id bigint,
  kind public.media_kind,
  average_score numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    media.tmdb_id,
    media.kind,
    round(avg(rating.score)::numeric, 1) as average_score,
    count(*)::bigint as rating_count
  from public.ratings rating
  join public.media media on media.id = rating.media_id
  left join public.privacy_settings privacy on privacy.user_id = rating.user_id
  where media.tmdb_id = any(p_tmdb_ids)
    and coalesce(privacy.ratings, 'public'::public.visibility) = 'public'::public.visibility
  group by media.tmdb_id, media.kind;
$$;

revoke all on function public.get_media_community_ratings(bigint[]) from public;
grant execute on function public.get_media_community_ratings(bigint[]) to anon, authenticated;

