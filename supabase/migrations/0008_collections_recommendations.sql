alter table public.media
  add column if not exists collection_tmdb_id bigint,
  add column if not exists collection_name text,
  add column if not exists collection_poster_path text;

create index if not exists media_collection_idx on public.media(collection_tmdb_id) where collection_tmdb_id is not null;
create index if not exists media_title_lower_idx on public.media(lower(title));
create index if not exists media_release_date_idx on public.media(release_date);
create index if not exists list_items_added_idx on public.list_items(list_id, added_at desc);
create index if not exists recommendations_user_score_idx on public.recommendations(user_id, score desc, media_id);

create policy "owners delete recommendations" on public.recommendations
  for delete using (user_id = auth.uid());
