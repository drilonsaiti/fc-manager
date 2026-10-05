"use client";
import { useEffect, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  const sizeClass = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={cn("relative w-full bg-pitch-900 border border-pitch-700 rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-up", sizeClass)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-pitch-800">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-pitch-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-pitch-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh] pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
