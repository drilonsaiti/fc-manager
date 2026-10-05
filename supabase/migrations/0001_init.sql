-- FC Manager — initial schema for Supabase (PostgreSQL 15+)
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Model: every team-owned row carries team_id, and child rows reference their parent
-- with a COMPOSITE foreign key (id, team_id). That makes it impossible — at the
-- database level — to attach a player from team B to a match of team A.
-- Security is Row Level Security keyed on team membership; the public availability
-- link never touches tables directly (see the public_* functions at the bottom).

create schema if not exists app;

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table public.team_members (
  team_id       uuid not null references public.teams (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null check (role in ('owner', 'coach', 'staff')),
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at    timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.team_invites (
  code        text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  team_id     uuid not null references public.teams (id) on delete cascade,
  role        text not null check (role in ('coach', 'staff')),
  created_by  uuid not null references auth.users (id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '7 days',
  used_by     uuid references auth.users (id) on delete set null,
  used_at     timestamptz
);
create index team_invites_team_idx on public.team_invites (team_id);

create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, team_id),
  unique (team_id, name)
);
create unique index seasons_one_active_per_team on public.seasons (team_id) where is_active;

create table public.players (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  shirt_number  smallint check (shirt_number between 0 and 99),
  positions     text[] not null default '{}',
  phone         text check (char_length(phone) <= 30),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (id, team_id)
);
create index players_team_idx on public.players (team_id);

create table public.matches (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams (id) on delete cascade,
  season_id         uuid,
  opponent          text not null check (char_length(btrim(opponent)) between 1 and 80),
  kickoff           timestamptz not null,
  venue             text not null default '' check (char_length(venue) <= 120),
  competition       text not null default 'league' check (competition in ('league', 'cup', 'friendly', 'tournament')),
  is_home           boolean not null default true,
  status            text not null default 'scheduled' check (status in ('scheduled', 'live', 'final', 'cancelled')),
  duration_minutes  smallint not null default 90 check (duration_minutes between 10 and 150),
  started_at        timestamptz,                      -- set when the coach taps "Kick off"
  our_score         smallint check (our_score >= 0),
  their_score       smallint check (their_score >= 0),
  notes             text check (char_length(notes) <= 2000),
  share_token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  responses_open    boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (id, team_id),
  foreign key (season_id, team_id) references public.seasons (id, team_id) on delete restrict,
  check (status <> 'final' or (our_score is not null and their_score is not null))
);
create index matches_team_kickoff_idx on public.matches (team_id, kickoff desc);
create index matches_season_idx on public.matches (season_id);

create table public.lineups (
  match_id    uuid primary key,
  team_id     uuid not null,
  formation   text not null check (char_length(formation) between 1 and 30),
  updated_at  timestamptz not null default now(),
  foreign key (match_id, team_id) references public.matches (id, team_id) on delete cascade
);

create table public.lineup_entries (
  match_id   uuid not null,
  team_id    uuid not null,
  player_id  uuid not null,
  role       text not null check (role in ('starter', 'bench')),
  slot_id    text,
  x          numeric(5, 2) check (x between 0 and 100),
  y          numeric(5, 2) check (y between 0 and 100),
  sort       smallint not null default 0,
  primary key (match_id, player_id),
  foreign key (match_id, team_id) references public.matches (id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.players (id, team_id) on delete cascade,
  check (
    (role = 'starter' and slot_id is not null and x is not null and y is not null)
    or (role = 'bench' and slot_id is null)
  )
);
create unique index lineup_one_player_per_slot on public.lineup_entries (match_id, slot_id) where role = 'starter';

create table public.match_events (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null,
  team_id            uuid not null,
  type               text not null check (type in ('goal', 'own_goal', 'yellow', 'red', 'sub')),
  side               text not null default 'us' check (side in ('us', 'them')),
  minute             smallint not null check (minute between 0 and 200),
  player_id          uuid,
  related_player_id  uuid,
  created_at         timestamptz not null default now(),
  foreign key (match_id, team_id) references public.matches (id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.players (id, team_id) on delete restrict,
  foreign key (related_player_id, team_id) references public.players (id, team_id) on delete restrict,
  -- opponent events are only goals / own goals (we do not track their players)
  check (side = 'us' or (type in ('goal', 'own_goal') and player_id is null and related_player_id is null)),
  -- a substitution always names who goes off (player_id) and who comes on (related_player_id)
  check (type <> 'sub' or (player_id is not null and related_player_id is not null and player_id <> related_player_id)),
  -- cards always name a player; an own goal by us names the player
  check (type not in ('yellow', 'red') or player_id is not null),
  check (not (type = 'own_goal' and side = 'us') or player_id is not null)
);
create index match_events_match_idx on public.match_events (match_id, minute, created_at);

create table public.match_responses (
  match_id    uuid not null,
  player_id   uuid not null,
  team_id     uuid not null,
  status      text not null check (status in ('yes', 'maybe', 'no')),
  updated_at  timestamptz not null default now(),
  primary key (match_id, player_id),
  foreign key (match_id, team_id) references public.matches (id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.players (id, team_id) on delete cascade
);

create table public.player_match_stats (
  match_id    uuid not null,
  player_id   uuid not null,
  team_id     uuid not null,
  started     boolean not null,
  minutes     smallint not null default 0 check (minutes between 0 and 200),
  goals       smallint not null default 0 check (goals >= 0),
  assists     smallint not null default 0 check (assists >= 0),
  yellow      smallint not null default 0 check (yellow between 0 and 2),
  red         smallint not null default 0 check (red between 0 and 1),
  own_goals   smallint not null default 0 check (own_goals >= 0),
  primary key (match_id, player_id),
  foreign key (match_id, team_id) references public.matches (id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.players (id, team_id) on delete restrict
);
create index player_match_stats_player_idx on public.player_match_stats (player_id);

create table public.trainings (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams (id) on delete cascade,
  season_id       uuid,
  starts_at       timestamptz not null,
  location        text not null default '' check (char_length(location) <= 120),
  kind            text check (kind in ('fitness', 'technical', 'tactical', 'match_practice', 'other')),
  notes           text check (char_length(notes) <= 2000),
  share_token     text not null unique default replace(gen_random_uuid()::text, '-', ''),
  responses_open  boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (id, team_id),
  foreign key (season_id, team_id) references public.seasons (id, team_id) on delete restrict
);
create index trainings_team_start_idx on public.trainings (team_id, starts_at desc);

create table public.training_responses (
  training_id  uuid not null,
  player_id    uuid not null,
  team_id      uuid not null,
  status       text check (status in ('yes', 'maybe', 'no')),   -- null = coach marked attendance without an RSVP
  attended     boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (training_id, player_id),
  foreign key (training_id, team_id) references public.trainings (id, team_id) on delete cascade,
  foreign key (player_id, team_id) references public.players (id, team_id) on delete cascade
);

-- Spam protection for the public endpoints (private schema, never exposed to the API).
create table app.rate_hits (
  key     text not null,
  bucket  timestamptz not null,
  hits    integer not null default 1,
  primary key (key, bucket)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER so RLS policies can read membership)
-- ─────────────────────────────────────────────────────────────────────────

create function app.is_member(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members m where m.team_id = p_team and m.user_id = auth.uid()
  );
$$;

create function app.can_manage(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = auth.uid() and m.role in ('owner', 'coach', 'staff')
  );
$$;

create function app.is_owner(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create function app.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger match_responses_touch before update on public.match_responses
  for each row execute function app.touch_updated_at();
create trigger training_responses_touch before update on public.training_responses
  for each row execute function app.touch_updated_at();
create trigger lineups_touch before update on public.lineups
  for each row execute function app.touch_updated_at();

-- Fixed-window rate limiter. Returns true while the caller is under the limit.
create function app.rate_ok(p_key text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into app.rate_hits (key, bucket, hits) values (p_key, v_bucket, 1)
  on conflict (key, bucket) do update set hits = app.rate_hits.hits + 1
  returning hits into v_hits;

  if random() < 0.02 then
    delete from app.rate_hits where bucket < now() - interval '2 hours';
  end if;

  return v_hits <= p_max;
end;
$$;

create function app.roster_json(p_team uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'number', p.shirt_number) order by p.name),
    '[]'::jsonb)
  from public.players p where p.team_id = p_team and p.active;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.teams              enable row level security;
alter table public.team_members       enable row level security;
alter table public.team_invites       enable row level security;
alter table public.seasons            enable row level security;
alter table public.players            enable row level security;
alter table public.matches            enable row level security;
alter table public.lineups            enable row level security;
alter table public.lineup_entries     enable row level security;
alter table public.match_events       enable row level security;
alter table public.match_responses    enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.trainings          enable row level security;
alter table public.training_responses enable row level security;

-- teams / membership: created only through create_team / join_team below.
create policy teams_select on public.teams for select to authenticated using (app.is_member(id));
create policy teams_update on public.teams for update to authenticated
  using (app.is_owner(id)) with check (app.is_owner(id));

create policy members_select on public.team_members for select to authenticated using (app.is_member(team_id));
create policy members_update on public.team_members for update to authenticated
  using (app.is_owner(team_id) and user_id <> auth.uid())
  with check (app.is_owner(team_id) and role in ('coach', 'staff'));
create policy members_delete on public.team_members for delete to authenticated
  using (app.is_owner(team_id) and user_id <> auth.uid());

create policy invites_select on public.team_invites for select to authenticated using (app.is_owner(team_id));
create policy invites_insert on public.team_invites for insert to authenticated
  with check (app.is_owner(team_id) and created_by = auth.uid());
create policy invites_delete on public.team_invites for delete to authenticated using (app.is_owner(team_id));

-- Everything else: members read, managers (owner/coach/staff) write — always within their own team.
do $$
declare t text;
begin
  foreach t in array array[
    'seasons', 'players', 'matches', 'lineups', 'lineup_entries', 'match_events',
    'match_responses', 'player_match_stats', 'trainings', 'training_responses'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (app.is_member(team_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (app.can_manage(team_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (app.can_manage(team_id)) with check (app.can_manage(team_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (app.can_manage(team_id))', t || '_delete', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Account / team workflows
-- ─────────────────────────────────────────────────────────────────────────

create function public.create_team(p_name text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_season uuid;
  v_year integer := extract(year from now())::integer;
  v_start integer := case when extract(month from now()) >= 7 then v_year else v_year - 1 end;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if (select count(*) from public.team_members where user_id = v_uid and role = 'owner') >= 3 then
    raise exception 'team limit reached' using errcode = '54000';
  end if;

  insert into public.teams (name, created_by) values (btrim(p_name), v_uid) returning id into v_team;
  insert into public.team_members (team_id, user_id, role, display_name)
    values (v_team, v_uid, 'owner', btrim(p_display_name));
  insert into public.seasons (team_id, name, is_active)
    values (v_team, v_start || '/' || lpad(((v_start + 1) % 100)::text, 2, '0'), true)
    returning id into v_season;

  return jsonb_build_object('team_id', v_team, 'season_id', v_season);
end;
$$;

create function public.join_team(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.team_invites%rowtype;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not app.rate_ok('join:' || v_uid::text, 10, 3600) then
    raise exception 'too many attempts' using errcode = '54000';
  end if;

  select * into v_invite from public.team_invites
  where code = lower(btrim(p_code)) and used_at is null and expires_at > now()
  for update;
  if not found then raise exception 'invalid or expired code' using errcode = 'P0002'; end if;

  insert into public.team_members (team_id, user_id, role, display_name)
    values (v_invite.team_id, v_uid, v_invite.role, btrim(p_display_name))
  on conflict (team_id, user_id) do nothing;
  update public.team_invites set used_by = v_uid, used_at = now() where code = v_invite.code;

  return v_invite.team_id;
end;
$$;

create function public.start_new_season(p_team uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_season uuid;
begin
  if not app.can_manage(p_team) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.seasons set is_active = false where team_id = p_team and is_active;
  insert into public.seasons (team_id, name, is_active) values (p_team, btrim(p_name), true)
    returning id into v_season;
  return v_season;
end;
$$;

-- Atomically replace a match's lineup. SECURITY INVOKER: RLS still applies.
create function public.save_lineup(p_match uuid, p_formation text, p_entries jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_team uuid;
begin
  select team_id into v_team from public.matches where id = p_match;
  if v_team is null then raise exception 'match not found' using errcode = 'P0002'; end if;
  if not app.can_manage(v_team) then raise exception 'not allowed' using errcode = '42501'; end if;
  if (select count(*) from jsonb_array_elements(p_entries) e where e ->> 'role' = 'starter') > 11 then
    raise exception 'a lineup has at most 11 starters' using errcode = '23514';
  end if;

  insert into public.lineups (match_id, team_id, formation) values (p_match, v_team, p_formation)
  on conflict (match_id) do update set formation = excluded.formation;

  delete from public.lineup_entries where match_id = p_match;
  insert into public.lineup_entries (match_id, team_id, player_id, role, slot_id, x, y, sort)
  select p_match, v_team, (e ->> 'player_id')::uuid, e ->> 'role', e ->> 'slot_id',
         (e ->> 'x')::numeric, (e ->> 'y')::numeric, coalesce((e ->> 'sort')::smallint, 0)
  from jsonb_array_elements(p_entries) e;
end;
$$;

-- Final whistle: store the result and per-player stats in one transaction.
create function public.finish_match(p_match uuid, p_our integer, p_their integer, p_stats jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_team uuid;
begin
  select team_id into v_team from public.matches where id = p_match;
  if v_team is null then raise exception 'match not found' using errcode = 'P0002'; end if;
  if not app.can_manage(v_team) then raise exception 'not allowed' using errcode = '42501'; end if;

  delete from public.player_match_stats where match_id = p_match;
  insert into public.player_match_stats
    (match_id, player_id, team_id, started, minutes, goals, assists, yellow, red, own_goals)
  select p_match, (s ->> 'player_id')::uuid, v_team, (s ->> 'started')::boolean,
         (s ->> 'minutes')::smallint, (s ->> 'goals')::smallint, (s ->> 'assists')::smallint,
         (s ->> 'yellow')::smallint, (s ->> 'red')::smallint, (s ->> 'own_goals')::smallint
  from jsonb_array_elements(p_stats) s;

  update public.matches set status = 'final', our_score = p_our, their_score = p_their where id = p_match;
end;
$$;

-- Reopen a finished match for corrections (stats are rebuilt when it is finished again).
create function public.reopen_match(p_match uuid) returns void
language plpgsql set search_path = '' as $$
declare v_team uuid;
begin
  select team_id into v_team from public.matches where id = p_match;
  if v_team is null then raise exception 'match not found' using errcode = 'P0002'; end if;
  if not app.can_manage(v_team) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.player_match_stats where match_id = p_match;
  update public.matches set status = 'live', our_score = null, their_score = null where id = p_match;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Season statistics (views run with the caller's rights, so RLS still applies)
-- ─────────────────────────────────────────────────────────────────────────

create view public.season_player_stats with (security_invoker = true) as
select
  m.team_id,
  m.season_id,
  s.player_id,
  count(*)::int                                                      as appearances,
  count(*) filter (where s.started)::int                             as starts,
  count(*) filter (where not s.started)::int                         as sub_appearances,
  coalesce(sum(s.minutes), 0)::int                                   as minutes,
  coalesce(sum(s.goals), 0)::int                                     as goals,
  coalesce(sum(s.assists), 0)::int                                   as assists,
  coalesce(sum(s.yellow), 0)::int                                    as yellow,
  coalesce(sum(s.red), 0)::int                                       as red,
  coalesce(sum(s.own_goals), 0)::int                                 as own_goals,
  count(*) filter (where m.our_score > m.their_score)::int           as wins,
  count(*) filter (where m.our_score = m.their_score)::int           as draws,
  count(*) filter (where m.our_score < m.their_score)::int           as losses
from public.player_match_stats s
join public.matches m on m.id = s.match_id
where m.status = 'final'
group by m.team_id, m.season_id, s.player_id;

create view public.season_training_attendance with (security_invoker = true) as
select
  t.team_id,
  t.season_id,
  r.player_id,
  count(*) filter (where r.attended)::int as attended
from public.training_responses r
join public.trainings t on t.id = r.training_id
where t.starts_at < now()
group by t.team_id, t.season_id, r.player_id;

-- ─────────────────────────────────────────────────────────────────────────
-- Public availability link (called ONLY by our server route with the service key)
-- ─────────────────────────────────────────────────────────────────────────

create function public.public_get_event(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'kind', 'match',
           'title', 'vs ' || m.opponent,
           'startsAt', m.kickoff,
           'place', m.venue,
           'team', t.name,
           'closed', (not m.responses_open) or m.status <> 'scheduled',
           'roster', app.roster_json(m.team_id))
    into v
  from public.matches m join public.teams t on t.id = m.team_id
  where m.share_token = p_token;
  if v is not null then return v; end if;

  select jsonb_build_object(
           'kind', 'training',
           'title', 'Training' || coalesce(' · ' || replace(tr.kind, '_', ' '), ''),
           'startsAt', tr.starts_at,
           'place', tr.location,
           'team', t.name,
           'closed', (not tr.responses_open) or tr.starts_at < now() - interval '1 day',
           'roster', app.roster_json(tr.team_id))
    into v
  from public.trainings tr join public.teams t on t.id = tr.team_id
  where tr.share_token = p_token;
  return v;
end;
$$;

create function public.public_submit_response(p_token text, p_player uuid, p_status text, p_client text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_match record;
  v_training record;
begin
  if p_status is null or p_status not in ('yes', 'maybe', 'no') then
    return jsonb_build_object('error', 'bad_status');
  end if;

  -- Per-device limit first (also covers guessing random tokens), then per-link limit.
  if not app.rate_ok('cli:' || coalesce(p_client, '?'), 60, 60) then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  select id, team_id, status, responses_open into v_match from public.matches where share_token = p_token;
  if found then
    if not app.rate_ok('tok:' || p_token, 300, 60) then return jsonb_build_object('error', 'rate_limited'); end if;
    if v_match.status <> 'scheduled' or not v_match.responses_open then
      return jsonb_build_object('error', 'closed');
    end if;
    if not exists (select 1 from public.players where id = p_player and team_id = v_match.team_id and active) then
      return jsonb_build_object('error', 'bad_player');
    end if;
    insert into public.match_responses (match_id, player_id, team_id, status)
      values (v_match.id, p_player, v_match.team_id, p_status)
    on conflict (match_id, player_id) do update set status = excluded.status;
    return jsonb_build_object('ok', true);
  end if;

  select id, team_id, starts_at, responses_open into v_training from public.trainings where share_token = p_token;
  if found then
    if not app.rate_ok('tok:' || p_token, 300, 60) then return jsonb_build_object('error', 'rate_limited'); end if;
    if not v_training.responses_open or v_training.starts_at < now() - interval '1 day' then
      return jsonb_build_object('error', 'closed');
    end if;
    if not exists (select 1 from public.players where id = p_player and team_id = v_training.team_id and active) then
      return jsonb_build_object('error', 'bad_player');
    end if;
    insert into public.training_responses (training_id, player_id, team_id, status)
      values (v_training.id, p_player, v_training.team_id, p_status)
    on conflict (training_id, player_id) do update set status = excluded.status;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('error', 'not_found');
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Privileges
-- ─────────────────────────────────────────────────────────────────────────

revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all functions in schema public from public;

grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.season_player_stats, public.season_training_attendance to authenticated;

grant execute on function
  public.create_team(text, text),
  public.join_team(text, text),
  public.start_new_season(uuid, text),
  public.save_lineup(uuid, text, jsonb),
  public.finish_match(uuid, integer, integer, jsonb),
  public.reopen_match(uuid)
to authenticated;

-- The public link functions are reachable only by the server (service role), never by browsers.
revoke execute on function public.public_get_event(text) from public, anon, authenticated;
revoke execute on function public.public_submit_response(text, uuid, text, text) from public, anon, authenticated;
grant  execute on function public.public_get_event(text) to service_role;
grant  execute on function public.public_submit_response(text, uuid, text, text) to service_role;
