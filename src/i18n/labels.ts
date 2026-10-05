import type { MessageKey, Params } from "./index";
import type { MessageLabels } from "@/features/availability/logic";
import type { ReportLabels } from "@/features/report/report";

type T = (key: MessageKey, params?: Params) => string;

/** Pieces of the WhatsApp/Viber message in the coach's language. */
export const messageLabels = (t: T): MessageLabels => ({
  askMatch: t("av.askMatch"),
  askTraining: t("av.askTraining"),
  // keep {title}/{when}/{names} placeholders for the builder to fill
  reminder: t("av.reminder", { title: "{title}", when: "{when}" }),
  waiting: t("av.waiting", { names: "{names}" }),
  pleaseAnswer: t("av.pleaseAnswer"),
});

export const reportLabels = (t: T): ReportLabels => ({
  result: { Win: t("r.win"), Draw: t("r.draw"), Loss: t("r.loss") },
  competition: { league: t("comp.league"), cup: t("comp.cup"), friendly: t("comp.friendly"), tournament: t("comp.tournament") },
  matchReport: t("r.matchReport"), goals: t("r.goals"), cards: t("r.cards"), subs: t("r.subs"), startingXI: t("r.xi"),
  bench: t("r.bench"), notes: t("r.notes"), assist: t("r.assistWord"), ownGoal: t("r.ownGoal"), opponent: t("r.opponentTag"),
  unknownPlayer: t("r.unknownPlayer"), goalFallback: t("r.goalFallback"),
  yellow: t("r.yellowCard"), red: t("r.redCard"), secondYellow: t("r.secondYellow"),
  min: t("r.min"), goal: t("r.goal"), card: t("r.card"), substitution: t("r.substitution"), no: t("r.no"),
  player: t("r.player"), position: t("r.position"), played: t("r.played"), cameOn: t("r.cameOn"), unused: t("r.unused"),
});
