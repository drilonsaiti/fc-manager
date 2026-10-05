import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANON, SERVICE, SYSTEM, addMatch, addPlayer, createDb, newTeam, newUser, run, user, type Db,
} from "./harness";

let db: Db;
beforeAll(async () => { db = await createDb(); }, 60_000);
afterAll(async () => { await db.close(); });

describe("create_team / membership", () => {
  it("creates the team, an owner membership and an active season", async () => {
    const owner = await newUser(db);
    const { teamId, seasonId } = await newTeam(db, owner);
    const members = await run(db, user(owner), "select role from public.team_members where team_id = $1", [teamId]);
    expect(members).toEqual([{ role: "owner" }]);
    const seasons = await run<{ id: string; is_active: boolean; name: string }>(
      db, user(owner), "select id, is_active, name from public.seasons where team_id = $1", [teamId]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]).toMatchObject({ id: seasonId, is_active: true });
    expect(seasons[0].name).toMatch(/^\d{4}\/\d{2}$/);
  });

  it("an outsider cannot see another team at all", async () => {
    const a = await newUser(db), b = await newUser(db);
    const { teamId } = await newTeam(db, a);
    await addPlayer(db, a, teamId, "Ardit", 7);
    expect(await run(db, user(b), "select * from public.teams where id = $1", [teamId])).toHaveLength(0);
    expect(await run(db, user(b), "select * from public.players where team_id = $1", [teamId])).toHaveLength(0);
    expect(await run(db, user(b), "select * from public.team_members where team_id = $1", [teamId])).toHaveLength(0);
  });

  it("nobody can insert themselves into a team directly", async () => {
    const a = await newUser(db), b = await newUser(db);
    const { teamId } = await newTeam(db, a);
    await expect(run(db, user(b),
      "insert into public.team_members (team_id, user_id, role, display_name) values ($1, $2, 'owner', 'Sneaky')",
      [teamId, b])).rejects.toThrow(/row-level security/);
  });

  it("an outsider cannot create data in someone else's team", async () => {
    const a = await newUser(db), b = await newUser(db);
    const { teamId } = await newTeam(db, a);
    await expect(run(db, user(b), "insert into public.players (team_id, name) values ($1, 'Intruder')", [teamId]))
      .rejects.toThrow(/row-level security/);
    await expect(run(db, user(b),
      "insert into public.matches (team_id, opponent, kickoff) values ($1, 'X', now())", [teamId]))
      .rejects.toThrow(/row-level security/);
  });

  it("a user can own at most 12 teams", async () => {
    const owner = await newUser(db);
    for (let i = 0; i < 12; i++) await newTeam(db, owner);
    await expect(run(db, user(owner), "select public.create_team('Fourth', 'Owner')")).rejects.toThrow(/team limit/);
  });
});

describe("invites", () => {
  it("an owner invites a coach who can then manage, once", async () => {
    const owner = await newUser(db), coach = await newUser(db), late = await newUser(db);
    const { teamId } = await newTeam(db, owner);
    const [inv] = await run<{ code: string }>(db, user(owner),
      "insert into public.team_invites (team_id, role, created_by) values ($1, 'coach', $2) returning code", [teamId, owner]);

    await run(db, user(coach), "select public.join_team($1, 'Coach Carl')", [inv.code]);
    await expect(run(db, user(coach), "insert into public.players (team_id, name) values ($1, 'Luan') returning id", [teamId]))
      .resolves.toHaveLength(1);

    await expect(run(db, user(late), "select public.join_team($1, 'Late')", [inv.code])).rejects.toThrow(/invalid or expired/);
  });

  it("expired and unknown codes are rejected", async () => {
    const owner = await newUser(db), other = await newUser(db);
    const { teamId } = await newTeam(db, owner);
    const [inv] = await run<{ code: string }>(db, user(owner),
      "insert into public.team_invites (team_id, role, created_by, expires_at) values ($1, 'staff', $2, now() - interval '1 minute') returning code",
      [teamId, owner]);
    await expect(run(db, user(other), "select public.join_team($1, 'X')", [inv.code])).rejects.toThrow(/invalid or expired/);
    await expect(run(db, user(other), "select public.join_team('nope', 'X')")).rejects.toThrow(/invalid or expired/);
  });

  it("only the owner can create invites; coaches cannot rename the team or promote themselves", async () => {
    const owner = await newUser(db), coach = await newUser(db);
    const { teamId } = await newTeam(db, owner);
    const [inv] = await run<{ code: string }>(db, user(owner),
      "insert into public.team_invites (team_id, role, created_by) values ($1, 'coach', $2) returning code", [teamId, owner]);
    await run(db, user(coach), "select public.join_team($1, 'Coach')", [inv.code]);

    await expect(run(db, user(coach),
      "insert into public.team_invites (team_id, role, created_by) values ($1, 'coach', $2)", [teamId, coach]))
      .rejects.toThrow(/row-level security/);
    expect(await run(db, user(coach), "update public.teams set name = 'Hacked' where id = $1 returning id", [teamId])).toHaveLength(0);
    expect(await run(db, user(coach),
      "update public.team_members set role = 'owner' where user_id = $1 returning user_id", [coach])).toHaveLength(0);
  });

  it("an owner cannot demote or remove themselves", async () => {
    const owner = await newUser(db);
    const { teamId } = await newTeam(db, owner);
    expect(await run(db, user(owner),
      "update public.team_members set role = 'coach' where user_id = $1 returning user_id", [owner])).toHaveLength(0);
    expect(await run(db, user(owner),
      "delete from public.team_members where user_id = $1 returning user_id", [owner])).toHaveLength(0);
    expect(await run(db, user(owner), "select 1 from public.team_members where team_id = $1", [teamId])).toHaveLength(1);
  });
});

describe("cross-team integrity (composite foreign keys)", () => {
  it("cannot put another team's player in this team's lineup, even for someone who manages both", async () => {
    const owner = await newUser(db);
    const a = await newTeam(db, owner, "A"), b = await newTeam(db, owner, "B");
    const playerB = await addPlayer(db, owner, b.teamId, "From B");
    const { matchId } = await addMatch(db, owner, a.teamId, a.seasonId);
    await expect(run(db, user(owner),
      "insert into public.lineup_entries (match_id, team_id, player_id, role) values ($1, $2, $3, 'bench')",
      [matchId, a.teamId, playerB])).rejects.toThrow(/foreign key/);
  });

  it("a match cannot use a season from another team", async () => {
    const owner = await newUser(db);
    const a = await newTeam(db, owner, "A"), b = await newTeam(db, owner, "B");
    await expect(addMatch(db, owner, a.teamId, b.seasonId)).rejects.toThrow(/foreign key/);
  });

  it("a finished match requires both scores", async () => {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const { matchId } = await addMatch(db, owner, t.teamId, t.seasonId);
    await expect(run(db, user(owner), "update public.matches set status = 'final' where id = $1", [matchId]))
      .rejects.toThrow(/check constraint/);
  });

  it("a player who has history cannot be deleted (they are archived instead)", async () => {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const p = await addPlayer(db, owner, t.teamId, "Veteran", 4);
    const { matchId } = await addMatch(db, owner, t.teamId, t.seasonId);
    await run(db, user(owner),
      "insert into public.match_events (match_id, team_id, type, minute, player_id) values ($1, $2, 'goal', 10, $3)",
      [matchId, t.teamId, p]);
    await expect(run(db, user(owner), "delete from public.players where id = $1", [p])).rejects.toThrow(/foreign key/);
  });
});

describe("match events constraints", () => {
  it("rejects malformed events", async () => {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const p1 = await addPlayer(db, owner, t.teamId, "One"), p2 = await addPlayer(db, owner, t.teamId, "Two");
    const { matchId } = await addMatch(db, owner, t.teamId, t.seasonId);
    const ins = (cols: string, vals: unknown[]) => run(db, user(owner),
      `insert into public.match_events (match_id, team_id, ${cols}) values ($1, $2, ${vals.map((_, i) => `$${i + 3}`).join(", ")})`,
      [matchId, t.teamId, ...vals]);

    await expect(ins("type, minute", ["sub", 60])).rejects.toThrow(/check constraint/);                       // sub needs both players
    await expect(ins("type, minute, player_id, related_player_id", ["sub", 60, p1, p1])).rejects.toThrow(/check constraint/); // same player
    await expect(ins("type, minute", ["yellow", 30])).rejects.toThrow(/check constraint/);                    // card needs a player
    await expect(ins("type, minute, side, player_id", ["yellow", 30, "them", p1])).rejects.toThrow(/check constraint/);
    await expect(ins("type, minute", ["goal", 250])).rejects.toThrow(/check constraint/);                     // minute range
    await expect(ins("type, minute, player_id, related_player_id", ["sub", 60, p1, p2])).resolves.toBeDefined();
    await expect(ins("type, minute, side", ["goal", 12, "them"])).resolves.toBeDefined();
  });
});

describe("save_lineup", () => {
  async function setup() {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const players: string[] = [];
    for (let i = 0; i < 13; i++) players.push(await addPlayer(db, owner, t.teamId, `P${i}`, i + 1));
    const m = await addMatch(db, owner, t.teamId, t.seasonId);
    return { owner, ...t, players, ...m };
  }
  const entry = (player_id: string, role: string, slot_id: string | null = null) =>
    ({ player_id, role, slot_id, x: slot_id ? 50 : null, y: slot_id ? 50 : null });

  it("replaces the whole lineup atomically", async () => {
    const s = await setup();
    await run(db, user(s.owner), "select public.save_lineup($1, '4-4-2', $2::jsonb)", [
      s.matchId, JSON.stringify([entry(s.players[0], "starter", "GK"), entry(s.players[1], "bench")])]);
    await run(db, user(s.owner), "select public.save_lineup($1, '4-3-3', $2::jsonb)", [
      s.matchId, JSON.stringify([entry(s.players[2], "starter", "GK")])]);
    const rows = await run<{ player_id: string }>(db, user(s.owner),
      "select player_id from public.lineup_entries where match_id = $1", [s.matchId]);
    expect(rows.map((r) => r.player_id)).toEqual([s.players[2]]);
    const [l] = await run<{ formation: string }>(db, user(s.owner), "select formation from public.lineups where match_id = $1", [s.matchId]);
    expect(l.formation).toBe("4-3-3");
  });

  it("rejects two players in one slot and more than 11 starters", async () => {
    const s = await setup();
    await expect(run(db, user(s.owner), "select public.save_lineup($1, '4-4-2', $2::jsonb)", [
      s.matchId, JSON.stringify([entry(s.players[0], "starter", "GK"), entry(s.players[1], "starter", "GK")])]))
      .rejects.toThrow(/unique/);
    const twelve = s.players.slice(0, 12).map((p, i) => entry(p, "starter", `S${i}`));
    await expect(run(db, user(s.owner), "select public.save_lineup($1, '4-4-2', $2::jsonb)", [s.matchId, JSON.stringify(twelve)]))
      .rejects.toThrow(/at most 11/);
  });

  it("a bench entry cannot carry a slot and a starter must have one", async () => {
    const s = await setup();
    await expect(run(db, user(s.owner), "select public.save_lineup($1, '4-4-2', $2::jsonb)", [
      s.matchId, JSON.stringify([{ player_id: s.players[0], role: "starter", slot_id: null, x: null, y: null }])]))
      .rejects.toThrow(/check constraint/);
  });

  it("another team's manager is refused", async () => {
    const s = await setup();
    const stranger = await newUser(db);
    await newTeam(db, stranger, "Other");
    await expect(run(db, user(stranger), "select public.save_lineup($1, '4-4-2', '[]'::jsonb)", [s.matchId]))
      .rejects.toThrow(/not allowed|match not found/);
  });
});

describe("finish_match and season stats", () => {
  it("stores the result and aggregates per season; a new season keeps history", async () => {
    const owner = await newUser(db), outsider = await newUser(db);
    const t = await newTeam(db, owner);
    await newTeam(db, outsider, "Other");
    const p = await addPlayer(db, owner, t.teamId, "Striker", 9);
    const win = await addMatch(db, owner, t.teamId, t.seasonId, "Win FC");
    const loss = await addMatch(db, owner, t.teamId, t.seasonId, "Loss FC");

    const stat = (goals: number, minutes: number) => JSON.stringify([
      { player_id: p, started: true, minutes, goals, assists: 0, yellow: 0, red: 0, own_goals: 0 }]);
    await run(db, user(owner), "select public.finish_match($1, 3, 1, $2::jsonb)", [win.matchId, stat(2, 90)]);
    await run(db, user(owner), "select public.finish_match($1, 0, 2, $2::jsonb)", [loss.matchId, stat(0, 60)]);

    const [agg] = await run<Record<string, number>>(db, user(owner),
      "select * from public.season_player_stats where player_id = $1", [p]);
    expect(agg).toMatchObject({ appearances: 2, starts: 2, minutes: 150, goals: 2, wins: 1, losses: 1, draws: 0 });

    // a second season starts empty, the first one keeps its numbers
    const newSeason = await run<{ id: string }>(db, user(owner), "select public.start_new_season($1, '2099/00') as id", [t.teamId]);
    const active = await run(db, user(owner), "select id from public.seasons where team_id = $1 and is_active", [t.teamId]);
    expect(active).toHaveLength(1);
    expect(active[0]).toEqual({ id: newSeason[0].id });
    const old = await run(db, user(owner),
      "select goals from public.season_player_stats where player_id = $1 and season_id = $2", [p, t.seasonId]);
    expect(old).toEqual([{ goals: 2 }]);

    // RLS flows through the view
    expect(await run(db, user(outsider), "select * from public.season_player_stats")).toHaveLength(0);
  });

  it("finishing twice replaces the stats instead of doubling them; reopen clears them", async () => {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const p = await addPlayer(db, owner, t.teamId, "Keeper", 1);
    const { matchId } = await addMatch(db, owner, t.teamId, t.seasonId);
    const stats = JSON.stringify([{ player_id: p, started: true, minutes: 90, goals: 0, assists: 0, yellow: 0, red: 0, own_goals: 0 }]);
    await run(db, user(owner), "select public.finish_match($1, 1, 0, $2::jsonb)", [matchId, stats]);
    await run(db, user(owner), "select public.finish_match($1, 1, 0, $2::jsonb)", [matchId, stats]);
    expect(await run(db, user(owner), "select * from public.player_match_stats where match_id = $1", [matchId])).toHaveLength(1);
    await run(db, user(owner), "select public.reopen_match($1)", [matchId]);
    expect(await run(db, user(owner), "select * from public.player_match_stats where match_id = $1", [matchId])).toHaveLength(0);
    const [m] = await run<{ status: string; our_score: number | null }>(db, user(owner), "select status, our_score from public.matches where id = $1", [matchId]);
    expect(m).toEqual({ status: "live", our_score: null });
  });
});

describe("public availability link", () => {
  async function setup() {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const ardit = await addPlayer(db, owner, t.teamId, "Ardit", 7);
    const besnik = await addPlayer(db, owner, t.teamId, "Besnik", 10);
    const m = await addMatch(db, owner, t.teamId, t.seasonId);
    return { owner, ...t, ardit, besnik, ...m };
  }
  const submit = (as: typeof SERVICE, token: string, player: string, status: string, client = crypto.randomUUID()) =>
    run<{ r: Record<string, unknown> }>(db, as, "select public.public_submit_response($1, $2, $3, $4) as r", [token, player, status, client]).then((x) => x[0].r);

  it("browsers (anon and signed in) can neither read tables nor call the public functions", async () => {
    const s = await setup();
    await expect(run(db, ANON, "select * from public.matches")).rejects.toThrow(/permission denied/);
    await expect(run(db, ANON, "select public.public_get_event($1)", [s.token])).rejects.toThrow(/permission denied/);
    await expect(run(db, user(s.owner), "select public.public_get_event($1)", [s.token])).rejects.toThrow(/permission denied/);
    await expect(run(db, user(s.owner), "select public.public_submit_response($1, $2, 'yes', 'c')", [s.token, s.ardit]))
      .rejects.toThrow(/permission denied/);
  });

  it("the server can load the event with the roster and nothing sensitive", async () => {
    const s = await setup();
    const [{ e }] = await run<{ e: Record<string, unknown> }>(db, SERVICE, "select public.public_get_event($1) as e", [s.token]);
    expect(e).toMatchObject({ kind: "match", title: "vs Rivals", closed: false, team: "FC Test" });
    expect((e.roster as { name: string }[]).map((p) => p.name)).toEqual(["Ardit", "Besnik"]);
    expect(JSON.stringify(e)).not.toMatch(/phone|created_by|share_token/);
    const [{ e: none }] = await run<{ e: unknown }>(db, SERVICE, "select public.public_get_event('missing') as e");
    expect(none).toBeNull();
  });

  it("records an answer, lets the player change it, and the coach sees it", async () => {
    const s = await setup();
    expect(await submit(SERVICE, s.token, s.ardit, "yes")).toEqual({ ok: true });
    expect(await submit(SERVICE, s.token, s.ardit, "no")).toEqual({ ok: true });
    const rows = await run(db, user(s.owner), "select player_id, status from public.match_responses where match_id = $1", [s.matchId]);
    expect(rows).toEqual([{ player_id: s.ardit, status: "no" }]);
  });

  it("rejects bad status, unknown token, someone else's player, and closed links", async () => {
    const s = await setup();
    const other = await setup();
    expect(await submit(SERVICE, s.token, s.ardit, "definitely")).toEqual({ error: "bad_status" });
    expect(await submit(SERVICE, "nope", s.ardit, "yes")).toEqual({ error: "not_found" });
    expect(await submit(SERVICE, s.token, other.ardit, "yes")).toEqual({ error: "bad_player" });
    await run(db, user(s.owner), "update public.matches set responses_open = false where id = $1", [s.matchId]);
    expect(await submit(SERVICE, s.token, s.ardit, "yes")).toEqual({ error: "closed" });
    const s2 = await setup();
    await run(db, user(s2.owner), "update public.matches set status = 'live' where id = $1", [s2.matchId]);
    expect(await submit(SERVICE, s2.token, s2.ardit, "yes")).toEqual({ error: "closed" });
  });

  it("an archived player cannot be answered for", async () => {
    const s = await setup();
    await run(db, user(s.owner), "update public.players set active = false where id = $1", [s.besnik]);
    expect(await submit(SERVICE, s.token, s.besnik, "yes")).toEqual({ error: "bad_player" });
    const [{ e }] = await run<{ e: { roster: unknown[] } }>(db, SERVICE, "select public.public_get_event($1) as e", [s.token]);
    expect(e.roster).toHaveLength(1);
  });

  it("rate-limits one device after 60 requests a minute", async () => {
    const s = await setup();
    const client = "spammer-device";
    let limited = 0;
    for (let i = 0; i < 65; i++) {
      const r = await submit(SERVICE, s.token, s.ardit, i % 2 ? "yes" : "no", client);
      if ("error" in r && r.error === "rate_limited") limited++;
    }
    expect(limited).toBe(5);
    // a different device is unaffected
    expect(await submit(SERVICE, s.token, s.ardit, "yes", "honest-device")).toEqual({ ok: true });
  });

  it("works the same for trainings", async () => {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const p = await addPlayer(db, owner, t.teamId, "Ermal", 5);
    const [tr] = await run<{ id: string; share_token: string }>(db, user(owner),
      "insert into public.trainings (team_id, season_id, starts_at, location, kind) values ($1, $2, now() + interval '2 days', 'Pitch 2', 'fitness') returning id, share_token",
      [t.teamId, t.seasonId]);
    const [{ e }] = await run<{ e: Record<string, unknown> }>(db, SERVICE, "select public.public_get_event($1) as e", [tr.share_token]);
    expect(e).toMatchObject({ kind: "training", title: "Training · fitness", closed: false });
    expect(await submit(SERVICE, tr.share_token, p, "maybe")).toEqual({ ok: true });
    expect(await run(db, user(owner), "select status from public.training_responses where training_id = $1", [tr.id]))
      .toEqual([{ status: "maybe" }]);
  });
});

describe("privileges", () => {
  it("anon has no access to any table, and the rate-limit table is private", async () => {
    await expect(run(db, ANON, "select * from public.players")).rejects.toThrow(/permission denied/);
    const owner = await newUser(db);
    await expect(run(db, user(owner), "select * from app.rate_hits")).rejects.toThrow(/permission denied/);
    expect(await run(db, SYSTEM, "select count(*)::int as n from app.rate_hits")).toBeDefined();
  });
});

describe("personal links and strict mode", () => {
  async function setup() {
    const owner = await newUser(db);
    const t = await newTeam(db, owner);
    const ardit = await addPlayer(db, owner, t.teamId, "Ardit", 7);
    const besnik = await addPlayer(db, owner, t.teamId, "Besnik", 10);
    const m = await addMatch(db, owner, t.teamId, t.seasonId);
    const codes = await run<{ id: string; access_code: string }>(db, user(owner), "select id, access_code from public.players where team_id = $1", [t.teamId]);
    const code = (id: string) => codes.find((c) => c.id === id)!.access_code;
    return { owner, ...t, ardit, besnik, ...m, code };
  }
  const submit = (token: string, player: string, client: string, code: string | null) =>
    run<{ r: Record<string, unknown> }>(db, SERVICE, "select public.public_submit_response($1, $2, 'yes', $3, $4) as r", [token, player, client, code]).then((x) => x[0].r);
  const get = (token: string, code: string | null) =>
    run<{ e: Record<string, unknown> }>(db, SERVICE, "select public.public_get_event($1, $2) as e", [token, code]).then((x) => x[0].e);

  it("every player has a long unique private code", async () => {
    const s = await setup();
    expect(s.code(s.ardit)).toMatch(/^[a-f0-9]{20}$/);
    expect(s.code(s.ardit)).not.toBe(s.code(s.besnik));
  });

  it("the personal link tells the page who it is, without the roster being needed", async () => {
    const s = await setup();
    const e = await get(s.token, s.code(s.ardit));
    expect(e.me).toMatchObject({ id: s.ardit, name: "Ardit" });
    expect((await get(s.token, "wrong"))?.me).toBeNull();
    expect((await get(s.token, null))?.me).toBeNull();
  });

  it("a wrong or someone else's code is refused even in open mode", async () => {
    const s = await setup();
    expect(await submit(s.token, s.ardit, "c1", s.code(s.besnik))).toEqual({ error: "bad_player" });
    expect(await submit(s.token, s.ardit, "c2", "nope")).toEqual({ error: "bad_player" });
    expect(await submit(s.token, s.ardit, "c3", s.code(s.ardit))).toEqual({ ok: true });
    expect(await submit(s.token, s.besnik, "c4", null)).toEqual({ ok: true }); // open mode still allows picking a name
  });

  it("strict mode hides the roster and only accepts personal links", async () => {
    const s = await setup();
    await run(db, user(s.owner), "update public.teams set strict_links = true where id = $1", [s.teamId]);
    const e = await get(s.token, null);
    expect(e.strict).toBe(true);
    expect(e.roster).toEqual([]);
    expect(await submit(s.token, s.ardit, "c5", null)).toEqual({ error: "bad_player" });
    expect(await submit(s.token, s.ardit, "c6", s.code(s.besnik))).toEqual({ error: "bad_player" });
    expect(await submit(s.token, s.ardit, "c7", s.code(s.ardit))).toEqual({ ok: true });
    expect((await get(s.token, s.code(s.ardit))).me).toMatchObject({ name: "Ardit" });
  });

  it("only the owner can switch strict mode", async () => {
    const s = await setup();
    const coach = await newUser(db);
    await run(db, user(s.owner), "insert into public.team_invites (team_id, role, created_by, code) values ($1, 'coach', $2, 'abc123')", [s.teamId, s.owner]);
    await run(db, user(coach), "select public.join_team('abc123', 'Coach')");
    await run(db, user(coach), "update public.teams set strict_links = true where id = $1", [s.teamId]);
    const [{ strict_links }] = await run<{ strict_links: boolean }>(db, user(s.owner), "select strict_links from public.teams where id = $1", [s.teamId]);
    expect(strict_links).toBe(false);
  });
});
