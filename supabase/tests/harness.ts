import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export type Actor =
  | { role: "postgres" }
  | { role: "anon" }
  | { role: "service_role" }
  | { role: "authenticated"; sub: string };

export const SYSTEM: Actor = { role: "postgres" };
export const ANON: Actor = { role: "anon" };
export const SERVICE: Actor = { role: "service_role" };
export const user = (sub: string): Actor => ({ role: "authenticated", sub });

/** A throw-away Postgres with Supabase-shaped roles and a stub `auth` schema. */
export async function createDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Run one statement as the given actor (RLS and privileges apply for non-postgres roles). */
export async function run<T = Record<string, unknown>>(db: Db, as: Actor, text: string, params: unknown[] = []) {
  await db.exec("reset role");
  if (as.role !== "postgres") {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [as.role === "authenticated" ? as.sub : ""]);
    await db.exec(`set role ${as.role}`);
  }
  try {
    return (await db.query<T>(text, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

export async function newUser(db: Db): Promise<string> {
  const id = crypto.randomUUID();
  await run(db, SYSTEM, "insert into auth.users (id) values ($1)", [id]);
  return id;
}

export async function newTeam(db: Db, owner: string, name = "FC Test") {
  const [row] = await run<{ create_team: { team_id: string; season_id: string } }>(
    db, user(owner), "select public.create_team($1, 'Owner') as create_team", [name]);
  return { teamId: row.create_team.team_id, seasonId: row.create_team.season_id };
}

export async function addPlayer(db: Db, owner: string, teamId: string, name: string, number: number | null = null) {
  const [row] = await run<{ id: string }>(
    db, user(owner),
    "insert into public.players (team_id, name, shirt_number) values ($1, $2, $3) returning id",
    [teamId, name, number]);
  return row.id;
}

export async function addMatch(db: Db, owner: string, teamId: string, seasonId: string | null, opponent = "Rivals") {
  const [row] = await run<{ id: string; share_token: string }>(
    db, user(owner),
    "insert into public.matches (team_id, season_id, opponent, kickoff, venue) values ($1, $2, $3, now() + interval '3 days', 'Main pitch') returning id, share_token",
    [teamId, seasonId, opponent]);
  return { matchId: row.id, token: row.share_token };
}
