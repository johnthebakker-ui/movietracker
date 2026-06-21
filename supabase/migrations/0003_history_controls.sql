-- Local deletion tombstones keep removed watches from being re-imported by Trakt.
create table if not exists public.watch_event_tombstones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  watched_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists watch_event_tombstones_lookup_idx on public.watch_event_tombstones(user_id, media_id, watched_at);
alter table public.watch_event_tombstones enable row level security;
revoke all on public.watch_event_tombstones from anon, authenticated;
