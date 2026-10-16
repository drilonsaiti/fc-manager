import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
const text = (v: string | null, max = 80) => v?.trim().slice(0, max) || null;
const date = (v: string | null) => v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const dateEnd = (v: string | null) => {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const end = new Date(`${v}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return end.toISOString();
  }
  return date(v);
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const action = q.get("action");
  const db = serviceClient();
  let result;
  if (action === "directory") {
    result = await db.rpc("public_team_directory", {
      p_query: text(q.get("q")), p_format: text(q.get("format"), 16),
      p_area: text(q.get("area")), p_level: text(q.get("level"), 24),
      p_limit: Math.min(100, Math.max(1, Number(q.get("limit") ?? 30) || 30)),
      p_offset: Math.max(0, Number(q.get("offset") ?? 0) || 0),
    });
  } else if (action === "challenges") {
    result = await db.rpc("public_open_challenges", {
      p_format: text(q.get("format"), 16), p_area: text(q.get("area")),
      p_from: date(q.get("from")) ?? new Date().toISOString(),
      p_to: dateEnd(q.get("to")) ?? new Date(Date.now() + 90 * 86400000).toISOString(),
      p_level: text(q.get("level"), 24),
      p_limit: Math.min(100, Math.max(1, Number(q.get("limit") ?? 30) || 30)),
      p_offset: Math.max(0, Number(q.get("offset") ?? 0) || 0),
    });
  } else if (action === "matches") {
    result = await db.rpc("public_upcoming_matches", {
      p_format: text(q.get("format"), 16), p_area: text(q.get("area")),
      p_from: date(q.get("from")) ?? new Date().toISOString(),
      p_to: dateEnd(q.get("to")) ?? new Date(Date.now() + 90 * 86400000).toISOString(),
      p_limit: Math.min(100, Math.max(1, Number(q.get("limit") ?? 30) || 30)),
      p_offset: Math.max(0, Number(q.get("offset") ?? 0) || 0),
    });
  } else if (action === "profile") {
    const slug = text(q.get("slug"), 80);
    if (!slug) return json({ error: "not_found" }, 404);
    result = await db.rpc("public_team_profile", { p_slug: slug });
    if (result.data == null) return json({ error: "not_found" }, 404);
  } else if (action === "schedule") {
    const slug = text(q.get("slug"), 80);
    if (!slug) return json({ error: "not_found" }, 404);
    result = await db.rpc("public_team_schedule", {
      p_slug: slug, p_from: date(q.get("from")) ?? new Date().toISOString(),
      p_to: date(q.get("to")) ?? new Date(Date.now() + 90 * 86400000).toISOString(),
    });
  } else return json({ error: "bad_request" }, 400);
  if (result.error) return json({ error: "server" }, 500);
  return json({ data: result.data });
}
