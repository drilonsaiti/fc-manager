"use client";
import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useEvents, useLineup } from "@/hooks/data";
import { buildReport } from "@/features/report/report";
import { formatKickoff } from "@/features/availability/logic";
import { buildPost, type PostKind } from "@/features/social/post";
import { postLabels, reportLabels } from "@/i18n/labels";
import { LANGS, localeOf, trIn, useT, type Lang } from "@/i18n";
import { copyText } from "@/lib/utils/clipboard";
import { cn } from "@/lib/utils/cn";
import { Modal } from "@/components/ui/Modal";
import type { Match, Player } from "@/types";

/** A ready-to-paste post for Instagram / Facebook / the group chat, in any of the three languages. */
export function PostModal({ match, players, teamName, onClose }: {
  match: Match; players: Player[]; teamName: string; onClose: () => void;
}) {
  const { t, lang: appLang } = useT();
  const { lineup } = useLineup(match.id);
  const { events } = useEvents(match.id);
  const hasLineup = !!lineup && lineup.entries.some((e) => e.role === "starter");
  const finished = match.status === "final";

  const [kind, setKind] = useState<PostKind>(finished ? "result" : "announce");
  const [lang, setLang] = useState<Lang>(appLang);
  // The coach's own edits; they apply only while the generated text they started from is unchanged.
  const [edit, setEdit] = useState<{ base: string; text: string } | null>(null);
  const [note, setNote] = useState("");

  const generated = useMemo(() => {
    const tl = (key: Parameters<typeof t>[0], params?: Record<string, string | number>) => trIn(lang, key, params);
    const locale = localeOf(lang);
    const report = buildReport({
      teamName, match, events, lineup, locale, labels: reportLabels(tl),
      players: new Map(players.map((p) => [p.id, { name: p.name, number: p.number }])),
    });
    return buildPost(kind, {
      teamName, report, lineup, labels: postLabels(tl),
      when: formatKickoff(match.kickoff, locale), venue: match.venue,
      competition: reportLabels(tl).competition[match.competition] ?? "",
    });
  }, [kind, lang, match, events, lineup, players, teamName]);

  const text = edit && edit.base === generated ? edit.text : generated;

  const kinds: { id: PostKind; label: Parameters<typeof t>[0]; enabled: boolean }[] = [
    { id: "announce", label: "post.announce", enabled: true },
    { id: "lineup", label: "post.lineup", enabled: hasLineup },
    { id: "result", label: "post.result", enabled: finished },
  ];
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const say = (s: string) => { setNote(s); setTimeout(() => setNote(""), 2500); };

  return (
    <Modal open onClose={onClose} title={t("post.title")}>
      <div className="space-y-4">
        <div role="tablist" className="grid grid-cols-3 gap-1 p-1 surface-2">
          {kinds.map((k) => (
            <button key={k.id} role="tab" aria-selected={kind === k.id} disabled={!k.enabled} onClick={() => setKind(k.id)}
              className={cn("py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-30",
                kind === k.id ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
              {t(k.label)}
            </button>
          ))}
        </div>
        {!hasLineup && kind === "announce" && <p className="text-xs text-pitch-500">{t("post.noLineup")}</p>}

        <div className="flex items-center gap-2" role="group" aria-label={t("post.language")}>
          {LANGS.map((l) => (
            <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}
              className={cn("px-3 py-1.5 rounded-full text-xs border", lang === l.id ? "bg-white text-black border-white font-medium" : "border-white/15 text-pitch-300")}>
              {l.label}
            </button>
          ))}
        </div>

        <textarea className="input-field font-mono text-sm min-h-64" value={text} onChange={(e) => setEdit({ base: generated, text: e.target.value })} aria-label={t("post.title")} />
        <p className="text-xs text-pitch-500">{t("post.editHint")}</p>

        <div className="flex gap-2">
          <button className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
            onClick={async () => say((await copyText(text)) ? t("post.copied") : t("c.copyFail"))}>
            <Copy className="w-4 h-4" />{t("post.copy")}
          </button>
          {canShare && (
            <button className="surface-2 px-4 flex items-center gap-2 text-sm" onClick={() => navigator.share({ text }).catch(() => {})}>
              <Share2 className="w-4 h-4" />{t("post.share")}
            </button>
          )}
        </div>
        <p role="status" className="text-xs text-green-400 min-h-4 flex items-center gap-1">{note && <Check className="w-3.5 h-3.5" />}{note}</p>
      </div>
    </Modal>
  );
}
