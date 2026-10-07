-- FC Manager — 0003: invite someone as owner, and let an owner change another member's role.
-- Run once in the Supabase SQL editor after 0002.

alter table public.team_invites drop constraint team_invites_role_check;
alter table public.team_invites add constraint team_invites_role_check check (role in ('owner', 'coach', 'staff'));

-- An owner can change another member's role (never their own, so a team always keeps its owner).
drop policy members_update on public.team_members;
create policy members_update on public.team_members for update to authenticated
  using (app.is_owner(team_id) and user_id <> auth.uid())
  with check (app.is_owner(team_id) and role in ('owner', 'coach', 'staff'));
