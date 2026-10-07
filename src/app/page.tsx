import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: { absolute: "FC Manager — team manager for amateur football" },
  description: "Availability by link, a drag-and-drop lineup, matchday stats and match reports. Built for amateur football teams. English, Shqip, Македонски.",
};

export default function Home() {
  return <Landing />;
}
