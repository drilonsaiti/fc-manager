import type { Metadata } from "next";
import { TeamDiscovery } from "@/components/public/TeamDiscovery";
export const revalidate = 300;
export const metadata: Metadata = {
  title: "Find teams and matches",
  description: "Browse public football teams, upcoming matches and open opponent challenges.",
};

export default function TeamsPage() {
  // The discovery client requests the currently selected filters on mount. Fetching
  // these rows here as well caused three duplicate database RPCs on every page load.
  return <TeamDiscovery teams={[]} matches={[]} challenges={[]} />;
}
