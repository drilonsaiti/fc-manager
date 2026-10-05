import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/server";
import { clientIp, isToken, originAllowed, validateSubmission, visitorKey } from "@/lib/public/validate";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

/** The event behind a public link: title, time, place and the squad's names. Nothing private. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) return json({ error: "not_found" }, 404);
  try {
    const { data, error } = await serviceClient().rpc("public_get_event", { p_token: token });
    if (error) return json({ error: "server" }, 500);
    if (!data) return json({ error: "not_found" }, 404);
    // A short shared cache absorbs the burst when the link lands in a group chat.
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } });
  } catch {
    return json({ error: "server" }, 500);
  }
}

/**
 * A player answers. Layers, cheapest first:
 *  1. same-origin check, 2. shape check, 3. honeypot + time trap (bots get a fake success),
 *  4. database: roster membership, open/closed and per-device / per-link rate limits.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!originAllowed(req.headers.get("origin"), req.headers.get("host"))) return json({ error: "forbidden" }, 403);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const verdict = validateSubmission(token, body);
  if (verdict.kind === "invalid") return json({ error: "bad_request" }, 400);
  if (verdict.kind === "bot") return json({ ok: true }); // look successful, write nothing

  const salt = process.env.PUBLIC_LINK_SALT;
  if (!salt) return json({ error: "server" }, 500);

  try {
    const { data, error } = await serviceClient().rpc("public_submit_response", {
      p_token: verdict.token,
      p_player: verdict.playerId,
      p_status: verdict.status,
      p_client: visitorKey(clientIp(req.headers), salt),
    });
    if (error) return json({ error: "server" }, 500);
    const result = data as { ok?: boolean; error?: string };
    if (result.ok) return json({ ok: true });
    switch (result.error) {
      case "bad_player": case "bad_status": return json({ error: "bad_request" }, 400);
      case "closed": return json({ error: "closed" }, 409);
      case "rate_limited": return json({ error: "rate_limited" }, 429);
      case "not_found": return json({ error: "not_found" }, 404);
      default: return json({ error: "server" }, 500);
    }
  } catch {
    return json({ error: "server" }, 500);
  }
}
