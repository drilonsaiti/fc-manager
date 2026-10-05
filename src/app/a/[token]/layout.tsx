import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Availability",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
