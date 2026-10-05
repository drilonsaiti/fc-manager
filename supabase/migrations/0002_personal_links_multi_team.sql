-- FC Manager — 0002: personal answer links, strict mode, more teams per coach.
-- Run once in the Supabase SQL editor after 0001.

-- 1. Every player gets a private code. A "personal link" is the event link plus ?p=<code>.
--    Identity lives in the link, not in the IP address or the device, so it survives 4G / VPN / a new phone.
alter table public.players
  add column access_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
create unique index players_access_code_key on public.players (access_code);

-- 2. Strict mode: the shared link no longer lists names; only personal links can answer.
alter table public.teams add column strict_links boolean not null default false;

-- 3. A coach may run more age groups (U19, U17 ...).
create or replace function public.create_team(p_name text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_season uuid;
  v_year integer := extract(year from now())::integer;
  v_start integer := case when extract(month from now()) >= 7 then v_year else v_year - 1 end;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if (select count(*) from public.team_members where user_id = v_uid and role = 'owner') >= 12 then
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

-- 4. Public link functions (server only), now aware of personal codes and strict mode.
drop function public.public_get_event(text);
drop function public.public_submit_response(text, uuid, text, text);

create function app.roster_json(p_team uuid, p_strict boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when p_strict then '[]'::jsonb else app.roster_json(p_team) end;
$$;

create function app.me_json(p_team uuid, p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'number', p.shirt_number)
  from public.players p
  where p_code is not null and p.team_id = p_team and p.active and p.access_code = p_code;
$$;

create function public.public_get_event(p_token text, p_code text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'kind', 'match',
           'title', 'vs ' || m.opponent,
           'startsAt', m.kickoff,
           'place', m.venue,
           'team', t.name,
           'teamId', t.id,
           'strict', t.strict_links,
           'closed', (not m.responses_open) or m.status <> 'scheduled',
           'me', app.me_json(m.team_id, p_code),
           'roster', app.roster_json(m.team_id, t.strict_links))
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
           'teamId', t.id,
           'strict', t.strict_links,
           'closed', (not tr.responses_open) or tr.starts_at < now() - interval '1 day',
           'me', app.me_json(tr.team_id, p_code),
           'roster', app.roster_json(tr.team_id, t.strict_links))
    into v
  from public.trainings tr join public.teams t on t.id = tr.team_id
  where tr.share_token = p_token;
  return v;
end;
$$;

-- p_code is the player's personal code. When present it must match p_player. In strict mode it is required.
create function public.public_submit_response(p_token text, p_player uuid, p_status text, p_client text, p_code text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_match record;
  v_training record;
  v_strict boolean;
begin
  if p_status is null or p_status not in ('yes', 'maybe', 'no') then
    return jsonb_build_object('error', 'bad_status');
  end if;

  if not app.rate_ok('cli:' || coalesce(p_client, '?'), 60, 60) then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  select id, team_id, status, responses_open into v_match from public.matches where share_token = p_token;
  if found then
    if not app.rate_ok('tok:' || p_token, 300, 60) then return jsonb_build_object('error', 'rate_limited'); end if;
    if v_match.status <> 'scheduled' or not v_match.responses_open then
      return jsonb_build_object('error', 'closed');
    end if;
    select strict_links into v_strict from public.teams where id = v_match.team_id;
    if not exists (
      select 1 from public.players
      where id = p_player and team_id = v_match.team_id and active
        and (p_code is null and not v_strict or access_code = p_code)
    ) then
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
    select strict_links into v_strict from public.teams where id = v_training.team_id;
    if not exists (
      select 1 from public.players
      where id = p_player and team_id = v_training.team_id and active
        and (p_code is null and not v_strict or access_code = p_code)
    ) then
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

revoke execute on function public.public_get_event(text, text) from public, anon, authenticated;
revoke execute on function public.public_submit_response(text, uuid, text, text, text) from public, anon, authenticated;
grant  execute on function public.public_get_event(text, text) to service_role;
grant  execute on function public.public_submit_response(text, uuid, text, text, text) to service_role;
grant  execute on function app.roster_json(uuid, boolean), app.me_json(uuid, text) to service_role;
