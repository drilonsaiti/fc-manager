import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { serviceClient } from "@/lib/supabase/server";
import { TeamProfile } from "@/components/public/TeamProfile";
import type { PublicMatchRow, PublicTeamRow } from "@/components/public/TeamDiscovery";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const db = serviceClient();
  const [profileResult, scheduleResult] = await Promise.all([
    db.rpc("public_team_profile", { p_slug: slug }),
    db.rpc("public_team_schedule", { p_slug: slug }),
  ]);
  if (profileResult.error || !profileResult.data) return null;
  return { profile: profileResult.data as PublicTeamRow, schedule: (scheduleResult.data ?? []) as PublicMatchRow[] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  return data ? { title: data.profile.name, description: data.profile.bio || `${data.profile.name} · ${data.profile.city}` } : { title: "Team not found" };
}

export default async function TeamPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  return <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
    <Link href="/teams" className="text-sm text-pitch-400 underline">← Find teams</Link>
    <TeamProfile profile={data.profile} matches={data.schedule} />
  </main>;
}
