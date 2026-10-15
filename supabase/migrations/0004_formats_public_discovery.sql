-- FC Manager — 0004: game formats, public team profiles, challenges and notifications.
-- Run after 0003_owner_invites.sql.
--
-- Rollback note: this is additive. To roll back before deploying application code,
-- drop the functions listed below, then app.notifications, app.challenge_requests,
-- app.challenges, the public indexes/triggers, and the added columns. This discards
-- profile, challenge, notification and visibility data; take a backup before doing so.

-- Formats are a finite application configuration. These checks mirror the keys in
-- src/features/formats/config.ts; the app test suite should assert key parity.
alter table public.teams
  add column default_format text not null default '11v11'
    check (default_format in ('11v11', '9v9', '7v7', '6v6', '5v5', '4v4', 'futsal')),
  add column is_public boolean not null default false,
  add column slug text,
  add column logo_url text check (logo_url is null or (char_length(logo_url) <= 500 and logo_url ~* '^https?://')),
  add column city text not null default '' check (char_length(city) <= 100),
  add column formats text[] not null default array['11v11']::text[],
  add column level text not null default 'any'
    check (level in ('any', 'beginner', 'recreational', 'intermediate', 'competitive', 'elite')),
  add column bio text not null default '' check (char_length(bio) <= 500),
  add column contact_preference text not null default 'in_app'
    check (contact_preference in ('in_app', 'email', 'phone')),
  add column public_schedule boolean not null default false,
  add column public_roster_count boolean not null default false,
  add column public_contact boolean not null default false;

alter table public.teams add constraint teams_slug_format_check
  check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.teams add constraint teams_formats_check
  check (cardinality(formats) between 1 and 7
    and formats <@ array['11v11', '9v9', '7v7', '6v6', '5v5', '4v4', 'futsal']::text[]);
alter table public.teams add constraint teams_public_slug_check check (not is_public or slug is not null);
alter table public.teams add constraint teams_default_format_enabled_check check (default_format = any(formats));
create unique index teams_slug_lower_key on public.teams (lower(slug)) where slug is not null;

alter table public.matches
  add column format text,
  add column is_public boolean not null default false;
update public.matches set format = '11v11';
alter table public.matches alter column format set not null;
alter table public.matches add constraint matches_format_check
  check (format in ('11v11', '9v9', '7v7', '6v6', '5v5', '4v4', 'futsal'));

-- New matches inherit the team's default unless the caller explicitly supplies an override.
create function app.set_match_format() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.format is null then
    select default_format into new.format from public.teams where id = new.team_id;
  end if;
  return new;
end;
$$;
create trigger matches_default_format before insert on public.matches
  for each row execute function app.set_match_format();

create table app.challenges (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  format text not null check (format in ('11v11', '9v9', '7v7', '6v6', '5v5', '4v4', 'futsal')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null check (char_length(btrim(location)) between 1 and 120),
  level text not null default 'any'
    check (level in ('any', 'beginner', 'recreational', 'intermediate', 'competitive', 'elite')),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'requested', 'accepted', 'declined', 'confirmed', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  check (ends_at is null or ends_at >= starts_at),
  check (expires_at > created_at)
);
create index challenges_discovery_idx on app.challenges (format, starts_at, status, team_id);
create index challenges_team_created_idx on app.challenges (team_id, created_at desc);

create table app.challenge_requests (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null,
  challenge_team_id uuid not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'cancelled', 'expired')),
  home_match_id uuid,
  away_match_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (home_match_id),
  unique (away_match_id),
  foreign key (challenge_id, challenge_team_id)
    references app.challenges (id, team_id) on delete cascade,
  foreign key (home_match_id, challenge_team_id)
    references public.matches (id, team_id),
  foreign key (away_match_id, team_id)
    references public.matches (id, team_id),
  check (team_id <> challenge_team_id)
);
create index challenge_requests_owner_idx on app.challenge_requests (challenge_team_id, status, created_at desc);
create index challenge_requests_requester_idx on app.challenge_requests (team_id, status, created_at desc);
create unique index challenge_requests_one_active_per_challenge
  on app.challenge_requests (challenge_id) where status <> 'cancelled';

create table app.notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('challenge_request', 'challenge_status')),
  challenge_id uuid,
  challenge_team_id uuid,
  request_id uuid,
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (challenge_id, challenge_team_id) references app.challenges (id, team_id) on delete cascade,
  check ((challenge_id is null) = (challenge_team_id is null))
);
create index notifications_team_unread_idx on app.notifications (team_id, created_at desc) where read_at is null;

create table app.team_blocks (
  team_id uuid not null references public.teams (id) on delete cascade,
  blocked_team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, blocked_team_id),
  check (team_id <> blocked_team_id)
);
create table app.challenge_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  challenge_id uuid not null,
  challenge_team_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (team_id, challenge_id),
  foreign key (challenge_id, challenge_team_id) references app.challenges (id, team_id) on delete cascade
);
create index challenge_reports_status_idx on app.challenge_reports (status, created_at);

alter table app.challenges enable row level security;
alter table app.challenge_requests enable row level security;
alter table app.notifications enable row level security;
alter table app.team_blocks enable row level security;
alter table app.challenge_reports enable row level security;

create policy challenges_team_select on app.challenges for select to authenticated
  using (app.is_member(team_id));
create policy challenges_team_insert on app.challenges for insert to authenticated
  with check (app.can_manage(team_id));
create policy challenges_team_update on app.challenges for update to authenticated
  using (app.can_manage(team_id)) with check (app.can_manage(team_id));
create policy challenges_team_delete on app.challenges for delete to authenticated
  using (app.can_manage(team_id));

create policy challenge_requests_member_select on app.challenge_requests for select to authenticated
  using (app.is_member(team_id) or app.is_member(challenge_team_id));
create policy notifications_member_select on app.notifications for select to authenticated
  using (app.is_member(team_id));
create policy notifications_member_update on app.notifications for update to authenticated
  using (app.is_member(team_id)) with check (app.is_member(team_id));
create policy team_blocks_member_select on app.team_blocks for select to authenticated
  using (app.is_member(team_id));
create policy challenge_reports_member_select on app.challenge_reports for select to authenticated
  using (app.is_member(team_id));

-- No direct browser privileges on private app-schema records.
revoke all on app.challenges, app.challenge_requests, app.notifications, app.team_blocks,
  app.challenge_reports from anon, authenticated;
grant select on app.challenges, app.challenge_requests, app.notifications, app.team_blocks,
  app.challenge_reports to authenticated;

create function app.touch_challenge_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger challenges_touch before update on app.challenges
  for each row execute function app.touch_challenge_updated_at();
create trigger challenge_requests_touch before update on app.challenge_requests
  for each row execute function app.touch_challenge_updated_at();

-- The trusted server supplies the authenticated user's verified UUID when invoking
-- service-role functions. The browser has no EXECUTE privilege on these functions.
create function app.can_manage_as(p_team uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = p_user and m.role in ('owner', 'coach', 'staff')
  );
$$;

create function app.is_member_as(p_team uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists (
    select 1 from public.team_members m where m.team_id = p_team and m.user_id = p_user
  );
$$;

revoke all on function app.can_manage_as(uuid, uuid), app.is_member_as(uuid, uuid) from public, anon, authenticated;
grant execute on function app.can_manage_as(uuid, uuid), app.is_member_as(uuid, uuid) to service_role;

-- Preserve custom formations while validating their player count against the match format.
create or replace function public.save_lineup(p_match uuid, p_formation text, p_entries jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  v_team uuid;
  v_format text;
  v_pitch integer;
  v_outfield integer;
  v_starters integer;
begin
  select team_id, format into v_team, v_format from public.matches where id = p_match;
  if v_team is null then raise exception 'match not found' using errcode = 'P0002'; end if;
  if not app.can_manage(v_team) then raise exception 'not allowed' using errcode = '42501'; end if;

  v_pitch := case v_format when '11v11' then 11 when '9v9' then 9 when '7v7' then 7
    when '6v6' then 6 when '5v5' then 5 when '4v4' then 4 when 'futsal' then 5 end;
  if p_formation !~ '^[1-6](-[1-6]){1,4}$' then
    raise exception 'invalid formation' using errcode = '23514';
  end if;
  select coalesce(sum(part::integer), 0) into v_outfield
    from unnest(string_to_array(p_formation, '-')) as parts(part);
  if v_outfield <> v_pitch - 1 then
    raise exception 'formation does not match format' using errcode = '23514';
  end if;
  select count(*) into v_starters from jsonb_array_elements(p_entries) e where e ->> 'role' = 'starter';
  if v_starters > v_pitch then
    raise exception 'a lineup has at most % starters for this format', v_pitch using errcode = '23514';
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

-- Narrow public output. The functions are service-role-only and never return player rows,
-- phone numbers, private links, notes from matches, or availability tokens.
create function public.public_team_profile(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', t.slug, 'name', t.name, 'logoUrl', t.logo_url, 'city', t.city,
    'formats', to_jsonb(t.formats), 'level', t.level, 'bio', t.bio,
    'contactPreference', case when t.public_contact then t.contact_preference else null end,
    'rosterCount', case when t.public_roster_count then
      (select count(*)::int from public.players p where p.team_id = t.id and p.active) else null end
  )
  from public.teams t
  where lower(t.slug) = lower(p_slug) and t.is_public;
$$;

create function public.team_challenge_inbox(p_actor uuid, p_team uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'challenges', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'format', c.format, 'startsAt', c.starts_at, 'endsAt', c.ends_at,
      'location', c.location, 'level', c.level, 'notes', c.notes, 'status', c.status,
      'expiresAt', c.expires_at) order by c.starts_at)
      from app.challenges c where c.team_id = p_team and c.status in ('open', 'requested')), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'challengeId', r.challenge_id, 'challengeTeamId', r.challenge_team_id,
      'teamId', r.team_id, 'teamName', requester.name, 'message', r.message,
      'status', r.status, 'createdAt', r.created_at, 'homeMatchId', r.home_match_id,
      'awayMatchId', r.away_match_id, 'format', c.format, 'startsAt', c.starts_at,
      'location', c.location, 'challengeStatus', c.status) order by r.created_at desc)
      from app.challenge_requests r join public.teams requester on requester.id = r.team_id
      join app.challenges c on c.id = r.challenge_id
      where r.challenge_team_id = p_team or r.team_id = p_team), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'payload', n.payload, 'createdAt', n.created_at,
      'readAt', n.read_at) order by n.created_at desc)
      from app.notifications n where n.team_id = p_team), '[]'::jsonb)
  )
  where app.can_manage_as(p_team, p_actor);
$$;

create function public.public_team_directory(
  p_query text default null, p_format text default null, p_area text default null,
  p_level text default null, p_limit integer default 30, p_offset integer default 0
) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', t.slug, 'name', t.name, 'logoUrl', t.logo_url, 'city', t.city,
    'formats', to_jsonb(t.formats), 'level', t.level, 'bio', t.bio,
    'rosterCount', case when t.public_roster_count then
      (select count(*)::int from public.players p where p.team_id = t.id and p.active) else null end
  )
  from public.teams t
  where t.is_public
    and (p_query is null or t.name ilike '%' || left(p_query, 80) || '%')
    and (p_area is null or t.city ilike '%' || left(p_area, 80) || '%')
    and (p_format is null or p_format = any(t.formats))
    and (p_level is null or t.level = p_level)
  order by t.name
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create function public.public_team_schedule(
  p_slug text, p_from timestamptz default now(), p_to timestamptz default now() + interval '90 days'
) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'matchId', m.id, 'kickoff', m.kickoff, 'format', m.format,
    'opponent', m.opponent, 'venue', m.venue, 'competition', m.competition
  )
  from public.matches m join public.teams t on t.id = m.team_id
  where t.slug = p_slug and t.is_public and t.public_schedule and m.is_public
    and m.status = 'scheduled' and m.kickoff >= p_from and m.kickoff < p_to
  order by m.kickoff
  limit 200;
$$;

create function public.public_upcoming_matches(
  p_format text default null, p_area text default null, p_from timestamptz default now(),
  p_to timestamptz default now() + interval '90 days', p_limit integer default 50, p_offset integer default 0
) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'matchId', m.id, 'kickoff', m.kickoff, 'format', m.format, 'opponent', m.opponent,
    'venue', m.venue, 'competition', m.competition, 'teamSlug', t.slug, 'teamName', t.name, 'city', t.city, 'level', t.level
  )
  from public.matches m join public.teams t on t.id = m.team_id
  where t.is_public and t.public_schedule and m.is_public and m.status = 'scheduled'
    and m.kickoff >= p_from and m.kickoff < p_to
    and (p_format is null or m.format = p_format)
    and (p_area is null or m.venue ilike '%' || left(p_area, 80) || '%' or t.city ilike '%' || left(p_area, 80) || '%')
  order by m.kickoff
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create function public.public_open_challenges(
  p_format text default null, p_area text default null, p_from timestamptz default now(),
  p_to timestamptz default now() + interval '90 days', p_level text default null,
  p_limit integer default 30, p_offset integer default 0
) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'teamId', t.id, 'teamSlug', t.slug, 'teamName', t.name, 'logoUrl', t.logo_url,
    'city', t.city, 'format', c.format, 'startsAt', c.starts_at, 'endsAt', c.ends_at,
    'location', c.location, 'level', c.level, 'notes', c.notes, 'expiresAt', c.expires_at
  )
  from app.challenges c join public.teams t on t.id = c.team_id
  where c.status = 'open' and c.starts_at >= p_from and c.starts_at < p_to
    and c.expires_at > now() and t.is_public
    and (p_format is null or c.format = p_format)
    and (p_area is null or c.location ilike '%' || left(p_area, 80) || '%'
      or t.city ilike '%' || left(p_area, 80) || '%')
    and (p_level is null or c.level = 'any' or c.level = p_level)
  order by c.starts_at
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Create a challenge through a trusted server action. The client identifier must be a
-- server-generated hash (for example, the existing salted-IP pattern), never a raw IP.
create function public.create_challenge(
  p_actor uuid, p_team uuid, p_format text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location text, p_level text, p_notes text, p_client_hash text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app.can_manage_as(p_team, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_format not in ('11v11', '9v9', '7v7', '6v6', '5v5', '4v4', 'futsal')
    or p_starts_at <= now() or (p_ends_at is not null and p_ends_at < p_starts_at)
    or char_length(btrim(coalesce(p_location, ''))) not between 1 and 120
    or p_level not in ('any', 'beginner', 'recreational', 'intermediate', 'competitive', 'elite')
    or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'invalid challenge' using errcode = '22023';
  end if;
  if not exists (select 1 from public.teams where id = p_team and p_format = any(formats)) then
    raise exception 'format is not enabled for this team' using errcode = '22023';
  end if;
  if not app.rate_ok('challenge-create:' || left(coalesce(p_client_hash, ''), 128), 10, 3600) then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  if not app.rate_ok('challenge-team:' || p_team::text, 5, 3600) then
    raise exception 'team challenge limit reached' using errcode = '54000';
  end if;
  insert into app.challenges (team_id, format, starts_at, ends_at, location, level, notes, expires_at)
  values (p_team, p_format, p_starts_at, p_ends_at, btrim(p_location), p_level,
    coalesce(p_notes, ''), least(p_starts_at, now() + interval '30 days'))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.request_challenge(p_actor uuid, p_challenge uuid, p_team uuid, p_message text, p_client_hash text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_c app.challenges%rowtype; v_request uuid;
begin
  if not app.can_manage_as(p_team, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not app.rate_ok('challenge-request:' || left(coalesce(p_client_hash, ''), 128), 20, 3600) then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  if not app.rate_ok('challenge-request-team:' || p_team::text, 10, 3600) then
    raise exception 'team request limit reached' using errcode = '54000';
  end if;
  select * into v_c from app.challenges where id = p_challenge for update;
  if not found or v_c.status <> 'open' or v_c.expires_at <= now() then
    raise exception 'challenge unavailable' using errcode = 'P0002';
  end if;
  if v_c.team_id = p_team then raise exception 'cannot request own challenge' using errcode = '22023'; end if;
  if not exists (select 1 from public.teams where id = p_team and v_c.format = any(formats)) then
    raise exception 'format is not enabled for this team' using errcode = '22023';
  end if;
  if exists (select 1 from app.team_blocks b where
      (b.team_id = v_c.team_id and b.blocked_team_id = p_team)
      or (b.team_id = p_team and b.blocked_team_id = v_c.team_id)) then
    raise exception 'team cannot request this challenge' using errcode = '42501';
  end if;
  if char_length(coalesce(p_message, '')) > 1000 then raise exception 'message too long' using errcode = '22023'; end if;
  insert into app.challenge_requests (challenge_id, challenge_team_id, team_id, message)
  values (v_c.id, v_c.team_id, p_team, coalesce(p_message, '')) returning id into v_request;
  update app.challenges set status = 'requested' where id = p_challenge;
  insert into app.notifications (team_id, kind, challenge_id, challenge_team_id, request_id, payload)
    values (v_c.team_id, 'challenge_request', v_c.id, v_c.team_id, v_request,
      jsonb_build_object('requestingTeamId', p_team));
  return v_request;
end;
$$;

create function public.respond_to_challenge(p_actor uuid, p_request uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_r app.challenge_requests%rowtype;
  v_c app.challenges%rowtype;
  v_home uuid;
  v_away uuid;
  v_season uuid;
  v_requester public.teams%rowtype;
begin
  select * into v_r from app.challenge_requests where id = p_request for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if not app.can_manage_as(v_r.challenge_team_id, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_r.status <> 'requested' then raise exception 'request already handled' using errcode = '22023'; end if;
  select * into v_c from app.challenges where id = v_r.challenge_id for update;
  if p_accept then
    select * into v_requester from public.teams where id = v_r.team_id;
    select id into v_season from public.seasons where team_id = v_r.challenge_team_id and is_active limit 1;
    insert into public.matches (team_id, season_id, opponent, kickoff, venue, competition, is_home, format)
      values (v_r.challenge_team_id, v_season, v_requester.name, v_c.starts_at, v_c.location, 'friendly', true, v_c.format)
      returning id into v_home;
    select id into v_season from public.seasons where team_id = v_r.team_id and is_active limit 1;
    insert into public.matches (team_id, season_id, opponent, kickoff, venue, competition, is_home, format)
      select v_r.team_id, v_season, t.name, v_c.starts_at, v_c.location, 'friendly', false, v_c.format
      from public.teams t where t.id = v_r.challenge_team_id
      returning id into v_away;
    update app.challenge_requests set status = 'accepted', home_match_id = v_home, away_match_id = v_away
      where id = p_request;
    update app.challenges set status = 'accepted' where id = v_c.id;
    insert into app.notifications (team_id, kind, challenge_id, challenge_team_id, request_id, payload)
      values (v_r.team_id, 'challenge_status', v_c.id, v_c.team_id, p_request, jsonb_build_object('status', 'accepted'));
    return jsonb_build_object('status', 'accepted', 'homeMatchId', v_home, 'awayMatchId', v_away);
  else
    update app.challenge_requests set status = 'declined' where id = p_request;
    update app.challenges set status = 'declined' where id = v_c.id;
    insert into app.notifications (team_id, kind, challenge_id, challenge_team_id, request_id, payload)
      values (v_r.team_id, 'challenge_status', v_c.id, v_c.team_id, p_request, jsonb_build_object('status', 'declined'));
    return jsonb_build_object('status', 'declined');
  end if;
end;
$$;

create function public.confirm_challenge(p_actor uuid, p_request uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_r app.challenge_requests%rowtype;
begin
  select * into v_r from app.challenge_requests where id = p_request for update;
  if not found or v_r.status <> 'accepted' then raise exception 'request not confirmable' using errcode = 'P0002'; end if;
  if not app.can_manage_as(v_r.team_id, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  update app.challenge_requests set status = 'accepted' where id = p_request;
  update app.challenges set status = 'confirmed' where id = v_r.challenge_id;
  insert into app.notifications (team_id, kind, challenge_id, challenge_team_id, request_id, payload)
    values (v_r.challenge_team_id, 'challenge_status', v_r.challenge_id, v_r.challenge_team_id, p_request,
      jsonb_build_object('status', 'confirmed'));
end;
$$;

create function public.cancel_challenge(p_actor uuid, p_challenge uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_c app.challenges%rowtype; v_r app.challenge_requests%rowtype;
begin
  select * into v_c from app.challenges where id = p_challenge for update;
  if not found then raise exception 'challenge not found' using errcode = 'P0002'; end if;
  if not app.can_manage_as(v_c.team_id, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_c.status in ('cancelled', 'declined', 'expired') then raise exception 'challenge cannot be cancelled' using errcode = '22023'; end if;
  select * into v_r from app.challenge_requests where challenge_id = p_challenge;
  update app.challenges set status = 'cancelled' where id = p_challenge;
  update app.challenge_requests set status = 'cancelled' where challenge_id = p_challenge and status = 'requested';
  if v_r.team_id is not null then
    if v_r.home_match_id is not null then
      update public.matches set status = 'cancelled' where id in (v_r.home_match_id, v_r.away_match_id);
    end if;
    insert into app.notifications (team_id, kind, challenge_id, challenge_team_id, request_id, payload)
      values (v_r.team_id, 'challenge_status', p_challenge, v_c.team_id, v_r.id,
        jsonb_build_object('status', 'cancelled'));
  end if;
end;
$$;

create function public.cancel_challenge_request(p_actor uuid, p_request uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_r app.challenge_requests%rowtype;
begin
  select * into v_r from app.challenge_requests where id = p_request for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if not app.can_manage_as(v_r.team_id, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_r.status <> 'requested' then raise exception 'request already handled' using errcode = '22023'; end if;
  update app.challenge_requests set status = 'cancelled' where id = p_request;
  update app.challenges set status = 'open' where id = v_r.challenge_id and status = 'requested';
  insert into app.notifications (team_id, kind, challenge_id, challenge_team_id, request_id, payload)
    values (v_r.challenge_team_id, 'challenge_status', v_r.challenge_id, v_r.challenge_team_id, p_request,
      jsonb_build_object('status', 'request_cancelled'));
end;
$$;

create function public.expire_challenges() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update app.challenges set status = 'expired'
    where status in ('open', 'requested') and expires_at <= now();
  get diagnostics v_count = row_count;
  with expired_requests as (
    update app.challenge_requests r set status = 'expired'
    from app.challenges c where c.id = r.challenge_id and c.status = 'expired' and r.status = 'requested'
    returning r.team_id, r.challenge_team_id, r.challenge_id, r.id
  )
  insert into app.notifications (team_id, kind, challenge_id, challenge_team_id, request_id, payload)
    select team_id, 'challenge_status', challenge_id, challenge_team_id, id, jsonb_build_object('status', 'expired')
    from expired_requests;
  return v_count;
end;
$$;

create function public.mark_notification_read(p_actor uuid, p_notification uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update app.notifications set read_at = now()
  where id = p_notification and app.is_member_as(team_id, p_actor);
end;
$$;

create function public.block_team(p_actor uuid, p_team uuid, p_blocked_team uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.can_manage_as(p_team, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_team = p_blocked_team then raise exception 'cannot block own team' using errcode = '22023'; end if;
  insert into app.team_blocks (team_id, blocked_team_id) values (p_team, p_blocked_team)
    on conflict (team_id, blocked_team_id) do nothing;
end;
$$;

create function public.unblock_team(p_actor uuid, p_team uuid, p_blocked_team uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.can_manage_as(p_team, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from app.team_blocks where team_id = p_team and blocked_team_id = p_blocked_team;
end;
$$;

create function public.report_challenge(
  p_actor uuid, p_team uuid, p_challenge uuid, p_reason text, p_client_hash text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_challenge_team uuid;
begin
  if not app.can_manage_as(p_team, p_actor) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not app.rate_ok('challenge-report:' || left(coalesce(p_client_hash, ''), 128), 10, 3600) then
    raise exception 'too many reports' using errcode = '54000';
  end if;
  if not app.rate_ok('challenge-report-team:' || p_team::text, 5, 3600) then
    raise exception 'team report limit reached' using errcode = '54000';
  end if;
  select team_id into v_challenge_team from app.challenges where id = p_challenge and team_id <> p_team;
  if not found then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
  insert into app.challenge_reports (team_id, challenge_id, challenge_team_id, reason)
    values (p_team, p_challenge, v_challenge_team, left(btrim(p_reason), 500))
    on conflict (team_id, challenge_id) do update set reason = excluded.reason, status = 'open'
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on all tables in schema app from anon;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema app to service_role;
grant execute on function public.public_team_profile(text),
  public.public_team_directory(text, text, text, text, integer, integer),
  public.public_team_schedule(text, timestamptz, timestamptz),
  public.public_upcoming_matches(text, text, timestamptz, timestamptz, integer, integer),
  public.public_open_challenges(text, text, timestamptz, timestamptz, text, integer, integer),
  public.team_challenge_inbox(uuid, uuid)
  to service_role;
grant execute on function public.create_challenge(uuid, uuid, text, timestamptz, timestamptz, text, text, text, text),
  public.request_challenge(uuid, uuid, uuid, text, text),
  public.respond_to_challenge(uuid, uuid, boolean), public.confirm_challenge(uuid, uuid),
  public.cancel_challenge(uuid, uuid), public.cancel_challenge_request(uuid, uuid),
  public.expire_challenges(), public.mark_notification_read(uuid, uuid),
  public.block_team(uuid, uuid, uuid), public.unblock_team(uuid, uuid, uuid),
  public.report_challenge(uuid, uuid, uuid, text, text)
  to service_role;

-- Restore existing authenticated workflows revoked above by the blanket revoke.
grant execute on function
  public.create_team(text, text), public.join_team(text, text), public.start_new_season(uuid, text),
  public.save_lineup(uuid, text, jsonb), public.finish_match(uuid, integer, integer, jsonb),
  public.reopen_match(uuid)
to authenticated;
grant execute on function public.public_get_event(text, text),
  public.public_submit_response(text, uuid, text, text, text)
to service_role;
