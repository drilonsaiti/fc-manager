"use client";
import { useState } from "react";
import { updateUserProfile } from "@/lib/firebase/firestore";
import { uploadPlayerImage } from "@/lib/firebase/storage";
import { Loader2, Camera } from "lucide-react";
import type { User, UserRole } from "@/types";

const POSITIONS = [
  "Goalkeeper","Right Back","Centre Back","Left Back",
  "Defensive Midfielder","Central Midfielder","Attacking Midfielder",
  "Right Winger","Left Winger","Striker","Second Striker",
];

export function PlayerForm({ player, onSuccess, canEditRole = false }: {
  player: User; onSuccess: () => void; canEditRole?: boolean;
}) {
  const [name, setName] = useState(player.name);
  const [position, setPosition] = useState(player.position ?? "");
  const [jerseyNumber, setJerseyNumber] = useState(player.jerseyNumber?.toString() ?? "");
  const [role, setRole] = useState<UserRole>(player.role);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(player.photoURL ?? null);
  const [error, setError] = useState("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      let photoURL = player.photoURL;
      if (imageFile) photoURL = await uploadPlayerImage(player.id, imageFile);
      await updateUserProfile(player.id, {
        name,
        position: position || undefined,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : undefined,
        role: canEditRole ? role : player.role,
        photoURL: photoURL ?? undefined,
      });
      onSuccess();
    } catch {
      setError("Failed to update profile.");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-center">
        <label className="relative cursor-pointer group">
          <div className="w-20 h-20 rounded-full bg-pitch-800 border-2 border-pitch-700 flex items-center justify-center overflow-hidden">
            {imagePreview
              ? <img src={imagePreview} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl font-display text-pitch-400">{name.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>
      </div>

      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Name *</label>
        <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Position</label>
          <select className="input-field" value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">— Select —</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Jersey #</label>
          <input type="number" min="1" max="99" className="input-field" placeholder="10"
            value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
        </div>
      </div>

      {canEditRole && (
        <div>
          <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Role</label>
          <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="owner">Owner</option>
            <option value="coach">Coach</option>
            <option value="staff">Staff</option>
            <option value="player">Player</option>
          </select>
        </div>
      )}

      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Changes
      </button>
    </form>
  );
}
