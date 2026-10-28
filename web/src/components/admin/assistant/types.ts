import type { Proposal } from "@/lib/assistant/schema";

export type StartData = { greeting: string; suggestions: string[]; approval: boolean };

/** Display details the server resolves for a proposal card. */
export type CardDetail = {
  /** "sreda, 28. oktober, 18.30, Sv. Križ" */
  when: string;
  /** cancel_mass / add_intention: the Mass's intentions now. */
  intentions?: { kind: "deceased" | "thanksgiving" | "other"; text: string }[];
  /** cancel_lesson: the group ("4.–6. razred"). */
  name?: string;
};

export type CardProposal = { proposal: Proposal; detail: CardDetail };

/** One assistant turn; `refused` when claude-pool was busy or failed. */
export type TurnData = { reply: string; cards: CardProposal[]; refused: boolean };
