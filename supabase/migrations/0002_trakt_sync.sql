-- Trakt OAuth connections and idempotent provider references.
-- These tables intentionally have RLS enabled without client policies: tokens are
-- only read and written by trusted server routes using the service-role client.

create table if not exists public.trakt_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  trakt_user_id text,
  trakt_username text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  scope text,
  sync_enabled boolean not null default true,
  last_synced_at timestamptz,
  last_activities jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_sync_refs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  resource_type text not null,
  external_id text not null,
  local_table text not null,
  local_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider, resource_type, external_id)
);

create index if not exists provider_sync_refs_user_idx
  on public.provider_sync_refs(user_id, provider, resource_type);

alter table public.trakt_connections enable row level security;
alter table public.provider_sync_refs enable row level security;

revoke all on public.trakt_connections from anon, authenticated;
revoke all on public.provider_sync_refs from anon, authenticated;

comment on table public.trakt_connections is 'Server-only encrypted OAuth credentials and Trakt sync cursors.';
comment on table public.provider_sync_refs is 'Idempotency map preventing duplicate imports from external providers.';
