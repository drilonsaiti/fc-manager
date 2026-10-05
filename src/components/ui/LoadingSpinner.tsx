export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" }[size];
  return <div className={`${s} border-2 border-pitch-700 border-t-white rounded-full animate-spin`} />;
}

export function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

/** Placeholder rows while a list loads: feels faster than a spinner and avoids layout jumps. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <div className="h-9 w-40 rounded-lg bg-white/5 animate-pulse mb-4" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-[68px] rounded-xl bg-white/[0.04] border border-white/5 animate-pulse" />
      ))}
    </div>
  );
}
