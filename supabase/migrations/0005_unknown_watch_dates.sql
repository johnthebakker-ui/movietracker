-- A real watch can exist without inventing a calendar date.
alter table public.watch_events
  alter column watched_at drop not null;

comment on column public.watch_events.watched_at is
  'When the watch happened. NULL means watched on an unknown date and is intentionally excluded from calendar views.';

-- Repair stale show completion left behind after episode watches were removed.
with show_completion as (
  select
    p.user_id,
    p.media_id,
    m.status as show_status,
    coalesce(m.number_of_episodes, 0) as total_episodes,
    count(distinct we.episode_id) filter (where coalesce(s.season_number, 1) <> 0) as watched_episodes
  from public.progress p
  join public.media m on m.id = p.media_id and m.kind = 'show'
  left join public.watch_events we on we.user_id = p.user_id and we.media_id = p.media_id and we.episode_id is not null
  left join public.episodes e on e.id = we.episode_id
  left join public.seasons s on s.id = e.season_id
  where p.status = 'completed'
  group by p.user_id, p.media_id, m.status, m.number_of_episodes
)
update public.progress p
set
  status = (case when c.watched_episodes > 0 then 'watching' else 'planned' end)::public.watch_status,
  completed_at = null,
  updated_at = now()
from show_completion c
where p.user_id = c.user_id
  and p.media_id = c.media_id
  and (c.show_status <> 'Ended' or c.total_episodes = 0 or c.watched_episodes < c.total_episodes);
