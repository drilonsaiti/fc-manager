import { cn } from "@/lib/utils/cn";

const variants: Record<string, string> = {
  default: "bg-pitch-800 text-pitch-300",
  yes: "bg-green-500/15 text-green-400 border border-green-500/25",
  no: "bg-red-500/15 text-red-400 border border-red-500/25",
  maybe: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  upcoming: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  finished: "bg-pitch-700 text-pitch-300",
  owner: "bg-amber-500/15 text-amber-400",
  coach: "bg-blue-500/15 text-blue-400",
  staff: "bg-purple-500/15 text-purple-400",
  player: "bg-green-500/15 text-green-400",
};

export function Badge({ variant = "default", children, className }: {
  variant?: string; children: React.ReactNode; className?: string;
}) {
  return <span className={cn("badge", variants[variant] ?? variants.default, className)}>{children}</span>;
}
