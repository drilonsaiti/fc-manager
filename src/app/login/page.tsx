"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { signIn, signUp } from "@/lib/firebase/auth";
import { createTeam } from "@/lib/firebase/firestore";
import { cn } from "@/lib/utils/cn";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        const teamId = await createTeam(teamName, "pending");
        await signUp(email, password, name, teamId, "owner");
      }
      router.replace("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const messages: Record<string, string> = {
        "auth/invalid-credential": "Invalid email or password.",
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Invalid email or password.",
        "auth/invalid-email": "Please enter a valid email address.",
      };
      setError(messages[code] ?? "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-dvh bg-pitch-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center">
            <Shield className="w-9 h-9 text-black" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-4xl text-white tracking-wider">FC MANAGER</h1>
            <p className="text-pitch-400 text-sm mt-1">Amateur Football Club Management</p>
          </div>
        </div>

        <div className="surface p-6 space-y-5">
          <div className="flex rounded-lg overflow-hidden border border-pitch-700 p-1 gap-1">
            {(["login","register"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
                className={cn("flex-1 py-2 text-sm font-medium rounded-md transition-all",
                  mode === m ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
                {m === "login" ? "Sign In" : "Create Club"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Club Name *</label>
                  <input className="input-field" placeholder="e.g. FC Warriors" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Your Name *</label>
                  <input className="input-field" placeholder="John Smith" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Email *</label>
              <input type="email" className="input-field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Password *</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="input-field pr-11" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pitch-400 hover:text-white transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Club & Account"}
            </button>
          </form>

          <p className="text-xs text-pitch-600 text-center">
            {mode === "register"
              ? "You'll be registered as club owner. Add players from the Players page."
              : "Players sign in with credentials provided by their manager."}
          </p>
        </div>
      </div>
    </div>
  );
}
