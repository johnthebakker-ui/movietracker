alter table public.lists
  add column if not exists featured_media_id bigint references public.media(id) on delete set null;

create index if not exists lists_featured_media_idx
  on public.lists(featured_media_id)
  where featured_media_id is not null;
