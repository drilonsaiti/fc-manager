"use client";
import { useState } from "react";
import { createTraining } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function TrainingForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", date: "", location: "", description: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.teamId) return;
    setError(""); setLoading(true);
    try {
      await createTraining({
        teamId: user.teamId, title: form.title,
        date: new Date(form.date), location: form.location,
        description: form.description || null,
      });
      onSuccess();
    } catch { setError("Failed to create training session."); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Title *</label>
        <input className="input-field" placeholder="e.g. Pre-match Training" value={form.title} onChange={(e) => set("title", e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Date & Time *</label>
        <input type="datetime-local" className="input-field" value={form.date} onChange={(e) => set("date", e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Location *</label>
        <input className="input-field" placeholder="e.g. Training Ground" value={form.location} onChange={(e) => set("location", e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Description</label>
        <textarea className="input-field resize-none" rows={2} placeholder="Optional notes..." value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Create Training
      </button>
    </form>
  );
}
