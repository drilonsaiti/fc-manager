-- Query-aware discovery functions keep search and pagination on the database side.
-- The original discovery RPCs remain available for existing callers.

create function public.search_upcoming_matches(
  p_query text, p_format text, p_area text, p_from timestamptz, p_to timestamptz,
  p_limit integer, p_offset integer
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
    and (p_query is null or concat_ws(' ', t.name, m.opponent, m.venue, m.competition, t.city) ilike '%' || left(p_query, 80) || '%')
  order by m.kickoff
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create function public.search_open_challenges(
  p_query text, p_format text, p_area text, p_from timestamptz, p_to timestamptz,
  p_level text, p_limit integer, p_offset integer
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
    and (p_query is null or concat_ws(' ', t.name, t.city, c.location, c.notes, c.format) ilike '%' || left(p_query, 80) || '%')
  order by c.starts_at
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.search_upcoming_matches(text, text, text, timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;
revoke all on function public.search_open_challenges(text, text, text, timestamptz, timestamptz, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_upcoming_matches(text, text, text, timestamptz, timestamptz, integer, integer),
  public.search_open_challenges(text, text, text, timestamptz, timestamptz, text, integer, integer)
  to service_role;
