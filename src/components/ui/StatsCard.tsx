import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const accents: Record<string, string> = {
  green: "text-green-400", red: "text-red-400",
  amber: "text-amber-400", blue: "text-blue-400", white: "text-white",
};

export function StatsCard({ label, value, icon: Icon, accent = "white", className }: {
  label: string; value: string | number; icon?: LucideIcon;
  accent?: "green" | "red" | "amber" | "blue" | "white"; className?: string;
}) {
  return (
    <div className={cn("stat-card", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-pitch-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-pitch-600" />}
      </div>
      <span className={cn("text-2xl font-display tracking-wider", accents[accent])}>{value}</span>
    </div>
  );
}
