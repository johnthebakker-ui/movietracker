create extension if not exists pgcrypto;

create type public.media_kind as enum ('movie', 'show');
create type public.watch_status as enum ('planned', 'watching', 'completed', 'paused', 'dropped');
create type public.visibility as enum ('public', 'followers', 'private');
create type public.follow_status as enum ('pending', 'accepted');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 500),
  avatar_url text,
  banner_url text,
  region text not null default 'US' check (char_length(region) = 2),
  language text not null default 'en-US',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  adult_content boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile public.visibility not null default 'public',
  activity public.visibility not null default 'public',
  history public.visibility not null default 'private',
  ratings public.visibility not null default 'public',
  favorites public.visibility not null default 'public',
  statistics public.visibility not null default 'public'
);

create table public.media (
  id bigint generated always as identity primary key,
  tmdb_id integer not null,
  kind public.media_kind not null,
  title text not null,
  original_title text,
  overview text,
  tagline text,
  poster_path text,
  backdrop_path text,
  release_date date,
  end_date date,
  runtime integer,
  status text,
  original_language text,
  origin_countries text[] not null default '{}',
  genres jsonb not null default '[]',
  keywords jsonb not null default '[]',
  credits jsonb not null default '{}',
  companies jsonb not null default '[]',
  videos jsonb not null default '[]',
  providers jsonb not null default '{}',
  external_ids jsonb not null default '{}',
  vote_average numeric(4,2),
  vote_count integer,
  popularity numeric,
  certification text,
  number_of_seasons integer,
  number_of_episodes integer,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tmdb_id, kind)
);
create index media_search_idx on public.media using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(original_title,'') || ' ' || coalesce(overview,'')));
create index media_release_idx on public.media (release_date desc);
create index media_popularity_idx on public.media (popularity desc);

create table public.seasons (
  id bigint generated always as identity primary key,
  media_id bigint not null references public.media(id) on delete cascade,
  tmdb_id integer,
  season_number integer not null,
  name text not null,
  overview text,
  poster_path text,
  air_date date,
  episode_count integer,
  vote_average numeric(4,2),
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (media_id, season_number)
);

create table public.episodes (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons(id) on delete cascade,
  tmdb_id integer unique,
  episode_number integer not null,
  name text not null,
  overview text,
  still_path text,
  air_date date,
  runtime integer,
  vote_average numeric(4,2),
  credits jsonb not null default '{}',
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

create table public.progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  status public.watch_status not null,
  current_episode_id bigint references public.episodes(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create table public.watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  watched_at timestamptz not null default now(),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  created_at timestamptz not null default now()
);
create index watch_events_user_date_idx on public.watch_events (user_id, watched_at desc);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id bigint references public.media(id) on delete cascade,
  season_id bigint references public.seasons(id) on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  score numeric(2,1) not null check (score between 0.5 and 5 and mod(score * 2, 1) = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(media_id, season_id, episode_id) = 1)
);
create unique index ratings_media_unique on public.ratings(user_id, media_id) where media_id is not null;
create unique index ratings_season_unique on public.ratings(user_id, season_id) where season_id is not null;
create unique index ratings_episode_unique on public.ratings(user_id, episode_id) where episode_id is not null;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating_id uuid references public.ratings(id) on delete set null,
  media_id bigint references public.media(id) on delete cascade,
  season_id bigint references public.seasons(id) on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 10000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(media_id, season_id, episode_id) = 1)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 1000),
  slug text not null,
  cover_url text,
  visibility public.visibility not null default 'public',
  ordered boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  position integer not null default 0,
  note text check (char_length(note) <= 1000),
  added_at timestamptz not null default now(),
  unique (list_id, media_id)
);
create index list_items_order_idx on public.list_items(list_id, position);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status public.follow_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recommendations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  score numeric not null,
  reasons jsonb not null default '[]',
  dismissed_at timestamptz,
  generated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  list_id uuid references public.lists(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(review_id, list_id) = 1)
);

create table public.reactions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  list_id uuid references public.lists(id) on delete cascade,
  kind text not null default 'like',
  created_at timestamptz not null default now(),
  check (num_nonnulls(review_id, list_id) = 1)
);
create unique index reactions_review_unique on public.reactions(user_id, review_id, kind) where review_id is not null;
create unique index reactions_list_unique on public.reactions(user_id, list_id, kind) where list_id is not null;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  follow_email boolean not null default true,
  interaction_email boolean not null default true,
  release_email boolean not null default true,
  digest_email boolean not null default false
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  status text not null default 'queued',
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  errors jsonb not null default '[]',
  payload_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  provider_id text,
  status text not null default 'queued',
  attempts integer not null default 0,
  error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_accepted_follower(owner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.follows where follower_id = auth.uid() and following_id = owner_id and status = 'accepted');
$$;

create or replace function public.can_view(owner_id uuid, level public.visibility)
returns boolean language sql stable security definer set search_path = public as $$
  select owner_id = auth.uid() or level = 'public' or (level = 'followers' and public.is_accepted_follower(owner_id));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_name text;
begin
  base_name := regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'member'), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base_name) < 3 then base_name := 'member'; end if;
  insert into public.profiles(id, username, display_name)
  values (new.id, left(base_name, 17) || '_' || substr(new.id::text, 1, 6), new.raw_user_meta_data->>'display_name');
  insert into public.privacy_settings(user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.progress enable row level security;
alter table public.watch_events enable row level security;
alter table public.ratings enable row level security;
alter table public.reviews enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.favorites enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.recommendations enable row level security;
alter table public.reports enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.import_jobs enable row level security;

create policy "catalog is public" on public.media for select using (deleted_at is null);
create policy "seasons are public" on public.seasons for select using (true);
create policy "episodes are public" on public.episodes for select using (true);
alter table public.media enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;

-- Basic identity remains discoverable so private accounts can receive follow requests;
-- all sensitive profile areas are protected by their own visibility policy.
create policy "basic profiles are discoverable" on public.profiles for select using (true);
create policy "users update profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "privacy levels are readable" on public.privacy_settings for select using (true);
create policy "users update privacy" on public.privacy_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owners manage progress" on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visible progress" on public.progress for select using (public.can_view(user_id, coalesce((select activity from public.privacy_settings where user_id = progress.user_id), 'private')));
create policy "owners manage watch events" on public.watch_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visible watch history" on public.watch_events for select using (public.can_view(user_id, coalesce((select history from public.privacy_settings where user_id = watch_events.user_id), 'private')));
create policy "visible ratings" on public.ratings for select using (public.can_view(user_id, coalesce((select ratings from public.privacy_settings where user_id = ratings.user_id), 'public')));
create policy "owners manage ratings" on public.ratings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visible reviews" on public.reviews for select using (public.can_view(user_id, coalesce((select ratings from public.privacy_settings where user_id = reviews.user_id), 'public')));
create policy "owners manage reviews" on public.reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visible lists" on public.lists for select using (public.can_view(user_id, visibility));
create policy "owners manage lists" on public.lists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visible list items" on public.list_items for select using (exists(select 1 from public.lists l where l.id = list_id and public.can_view(l.user_id, l.visibility)));
create policy "owners manage list items" on public.list_items for all using (exists(select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())) with check (exists(select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "visible favorites" on public.favorites for select using (public.can_view(user_id, coalesce((select favorites from public.privacy_settings where user_id = favorites.user_id), 'public')));
create policy "owners manage favorites" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "follow relationships visible" on public.follows for select using (follower_id = auth.uid() or following_id = auth.uid() or status = 'accepted');
create policy "users create follows" on public.follows for insert with check (follower_id = auth.uid());
create policy "participants update follows" on public.follows for update using (follower_id = auth.uid() or following_id = auth.uid());
create policy "participants delete follows" on public.follows for delete using (follower_id = auth.uid() or following_id = auth.uid());
create policy "owners manage blocks" on public.blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "owners view notifications" on public.notifications for select using (user_id = auth.uid());
create policy "owners update notifications" on public.notifications for update using (user_id = auth.uid());
create policy "owners view recommendations" on public.recommendations for select using (user_id = auth.uid());
create policy "owners update recommendations" on public.recommendations for update using (user_id = auth.uid());
create policy "users submit reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "users view own reports" on public.reports for select using (reporter_id = auth.uid());
create policy "comments are visible with targets" on public.comments for select using (true);
create policy "owners manage comments" on public.comments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reactions are visible" on public.reactions for select using (true);
create policy "owners manage reactions" on public.reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage notification preferences" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners manage imports" on public.import_jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_follow_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, actor_id, kind, payload)
    values(new.following_id, new.follower_id, case when new.status='pending' then 'follow_request' else 'new_follower' end, jsonb_build_object('followerId', new.follower_id));
  elsif old.status='pending' and new.status='accepted' then
    insert into public.notifications(user_id, actor_id, kind, payload)
    values(new.follower_id, new.following_id, 'follow_accepted', jsonb_build_object('followingId', new.following_id));
  end if;
  return new;
end;
$$;
create trigger on_follow_change after insert or update on public.follows for each row execute procedure public.notify_follow_change();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "profile images public" on storage.objects for select using (bucket_id = 'profile-media');
create policy "users upload own profile images" on storage.objects for insert to authenticated with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own profile images" on storage.objects for update to authenticated using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own profile images" on storage.objects for delete to authenticated using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
