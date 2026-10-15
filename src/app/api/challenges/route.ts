import { NextResponse, type NextRequest } from "next/server";
import { clientIp, originAllowed, visitorKey } from "@/lib/public/validate";
import { requestActor, serviceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMATS = new Set(["11v11", "9v9", "7v7", "6v6", "5v5", "4v4", "futsal"]);
const clientHash = (req: NextRequest) => {
  const salt = process.env.LINK_HASH_SALT ?? process.env.PUBLIC_LINK_SALT;
  return salt ? visitorKey(clientIp(req.headers), salt) : null;
};

export async function GET(req: NextRequest) {
  const actor = await requestActor(req);
  const team = req.nextUrl.searchParams.get("team");
  if (!actor) return json({ error: "unauthorized" }, 401);
  if (!team || !UUID.test(team)) return json({ error: "bad_request" }, 400);
  const { data, error } = await serviceClient().rpc("team_challenge_inbox", { p_actor: actor, p_team: team });
  if (error) return json({ error: "not_allowed" }, 403);
  return json(data ?? { challenges: [], requests: [], notifications: [] });
}

export async function POST(req: NextRequest) {
  if (!originAllowed(req.headers.get("origin"), req.headers.get("host"))) return json({ error: "forbidden" }, 403);
  const actor = await requestActor(req);
  if (!actor) return json({ error: "unauthorized" }, 401);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return json({ error: "bad_request" }, 400);
  const b = body as Record<string, unknown>;
  const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
  const service = serviceClient();
  let result;
  switch (b.action) {
    case "create": {
      const hash = clientHash(req);
      if (!hash) return json({ error: "server" }, 500);
      if (!uuid(b.teamId) || typeof b.format !== "string" || !FORMATS.has(b.format)
        || typeof b.startsAt !== "string" || !Number.isFinite(Date.parse(b.startsAt))
        || (b.endsAt != null && (typeof b.endsAt !== "string" || !Number.isFinite(Date.parse(b.endsAt))))
        || typeof b.location !== "string" || typeof b.level !== "string"
        || (b.notes != null && typeof b.notes !== "string")) return json({ error: "bad_request" }, 400);
      result = await service.rpc("create_challenge", {
        p_actor: actor, p_team: b.teamId, p_format: b.format, p_starts_at: b.startsAt,
        p_ends_at: b.endsAt ?? null, p_location: b.location, p_level: b.level,
        p_notes: b.notes ?? "", p_client_hash: hash,
      });
      break;
    }
    case "request": {
      const hash = clientHash(req);
      if (!hash) return json({ error: "server" }, 500);
      if (!uuid(b.teamId) || !uuid(b.challengeId) || (b.message != null && typeof b.message !== "string")) return json({ error: "bad_request" }, 400);
      result = await service.rpc("request_challenge", {
        p_actor: actor, p_challenge: b.challengeId, p_team: b.teamId,
        p_message: b.message ?? "", p_client_hash: hash,
      });
      break;
    }
    case "respond":
      if (!uuid(b.requestId) || typeof b.accept !== "boolean") return json({ error: "bad_request" }, 400);
      result = await service.rpc("respond_to_challenge", { p_actor: actor, p_request: b.requestId, p_accept: b.accept });
      break;
    case "confirm":
      if (!uuid(b.requestId)) return json({ error: "bad_request" }, 400);
      result = await service.rpc("confirm_challenge", { p_actor: actor, p_request: b.requestId });
      break;
    case "cancel":
      if (!uuid(b.challengeId)) return json({ error: "bad_request" }, 400);
      result = await service.rpc("cancel_challenge", { p_actor: actor, p_challenge: b.challengeId });
      break;
    case "cancel_request":
      if (!uuid(b.requestId)) return json({ error: "bad_request" }, 400);
      result = await service.rpc("cancel_challenge_request", { p_actor: actor, p_request: b.requestId });
      break;
    case "read_notification":
      if (!uuid(b.notificationId)) return json({ error: "bad_request" }, 400);
      result = await service.rpc("mark_notification_read", { p_actor: actor, p_notification: b.notificationId });
      break;
    case "block": case "unblock":
      if (!uuid(b.teamId) || !uuid(b.blockedTeamId)) return json({ error: "bad_request" }, 400);
      result = await service.rpc(b.action === "block" ? "block_team" : "unblock_team", {
        p_actor: actor, p_team: b.teamId, p_blocked_team: b.blockedTeamId,
      });
      break;
    case "report": {
      const hash = clientHash(req);
      if (!hash) return json({ error: "server" }, 500);
      if (!uuid(b.teamId) || !uuid(b.challengeId) || typeof b.reason !== "string") return json({ error: "bad_request" }, 400);
      result = await service.rpc("report_challenge", {
        p_actor: actor, p_team: b.teamId, p_challenge: b.challengeId,
        p_reason: b.reason, p_client_hash: hash,
      });
      break;
    }
    default: return json({ error: "bad_request" }, 400);
  }
  if (result.error) {
    const msg = result.error.message ?? "";
    if (/too many|limit reached/i.test(msg)) return json({ error: "rate_limited" }, 429);
    if (/not allowed|cannot request|cannot be|cannot block/i.test(msg)) return json({ error: "not_allowed" }, 403);
    if (/unavailable|not found|not confirmable/i.test(msg)) return json({ error: "not_found" }, 404);
    return json({ error: "invalid" }, 400);
  }
  return json({ data: result.data });
}
