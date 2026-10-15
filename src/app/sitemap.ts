import type { MetadataRoute } from "next";
import { serviceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fc-manager-psi.vercel.app";
  const db = serviceClient();
  const teams: { slug: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data } = await db.rpc("public_team_directory", { p_limit: 100, p_offset: offset });
    const page = (data ?? []) as { slug: string }[];
    teams.push(...page);
    if (page.length < 100) break;
  }
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/teams`, changeFrequency: "daily", priority: 0.8 },
    ...teams.map((team) => ({ url: `${base}/teams/${encodeURIComponent(team.slug)}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
