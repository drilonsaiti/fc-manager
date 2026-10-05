"use client";
import { useState } from "react";
import { createManagedUser } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Copy, Check, Eye, EyeOff } from "lucide-react";
import type { UserRole } from "@/types";

export function AddMemberForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"coach" as UserRole });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState<{ name:string; email:string; password:string } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const generatePassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
    const pw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    set("password", pw); setShowPw(true);
  };

  const copyCredentials = async () => {
    if (!done) return;
    await navigator.clipboard.writeText(`FC Manager Login\nEmail: ${done.email}\nPassword: ${done.password}\nLogin: ${window.location.origin}/login`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.teamId) return;
    setError(""); setLoading(true);
    try {
      await createManagedUser(form.email, form.password, form.name, user.teamId, form.role);
      setDone({ name: form.name, email: form.email, password: form.password });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const messages: Record<string, string> = {
        "auth/email-already-in-use": "Email already registered.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
      };
      setError(messages[code] ?? "Failed to create account.");
    } finally { setLoading(false); }
  }

  if (done) return (
    <div className="space-y-4 text-center">
      <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto">
        <Check className="w-7 h-7 text-green-400" />
      </div>
      <div>
        <p className="text-white font-semibold">{done.name} added!</p>
        <p className="text-pitch-500 text-sm mt-1">Share these credentials so they can sign in.</p>
      </div>
      <div className="surface-2 rounded-xl p-4 text-left space-y-2">
        <div className="flex justify-between"><span className="text-xs text-pitch-500 uppercase">Email</span><span className="text-sm text-white font-mono">{done.email}</span></div>
        <div className="border-t border-pitch-800" />
        <div className="flex justify-between"><span className="text-xs text-pitch-500 uppercase">Password</span><span className="text-sm text-white font-mono">{done.password}</span></div>
      </div>
      <button onClick={copyCredentials}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${copied ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-pitch-700 text-pitch-400 hover:border-pitch-500 hover:text-white"}`}>
        {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy login details</>}
      </button>
      <div className="flex gap-2">
        <button onClick={() => { setDone(null); setForm({ name:"",email:"",password:"",role:"coach" }); }} className="flex-1 btn-ghost text-sm py-2.5">Add Another</button>
        <button onClick={onSuccess} className="flex-1 btn-primary text-sm py-2.5">Done</button>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-pitch-400 mb-2 uppercase tracking-wide">Role</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["coach","staff","owner"] as UserRole[]).map((r) => (
            <button key={r} type="button" onClick={() => set("role", r)}
              className={`py-2 rounded-lg text-xs font-medium capitalize transition-all ${form.role === r ? "bg-white text-black" : "bg-pitch-800 text-pitch-400 hover:bg-pitch-700 hover:text-white"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Full Name *</label>
        <input className="input-field" placeholder="John Smith" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Email *</label>
        <input type="email" className="input-field" placeholder="john@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} required />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-pitch-400 uppercase tracking-wide">Password *</label>
          <button type="button" onClick={generatePassword} className="text-xs text-pitch-500 hover:text-white transition-colors">Generate random</button>
        </div>
        <div className="relative">
          <input type={showPw ? "text" : "password"} className="input-field pr-11" placeholder="Min. 6 characters"
            value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pitch-500 hover:text-white transition-colors">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Creating..." : "Add login"}
      </button>
    </form>
  );
}
