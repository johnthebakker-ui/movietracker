create table if not exists public.recommendation_dismissals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

alter table public.recommendation_dismissals enable row level security;

create policy "owners view recommendation dismissals" on public.recommendation_dismissals
  for select using (user_id = auth.uid());

create policy "owners add recommendation dismissals" on public.recommendation_dismissals
  for insert with check (user_id = auth.uid());

create policy "owners update recommendation dismissals" on public.recommendation_dismissals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owners remove recommendation dismissals" on public.recommendation_dismissals
  for delete using (user_id = auth.uid());
