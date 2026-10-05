import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Touches the database so the free Supabase project is not paused for inactivity. */
export async function GET() {
  try {
    const { error } = await serviceClient().from("teams").select("id", { head: true, count: "exact" }).limit(1);
    return NextResponse.json({ ok: !error }, { status: error ? 500 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
