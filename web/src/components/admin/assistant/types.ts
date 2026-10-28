import type { Section } from "@/lib/admin/sections";
import type { Proposal } from "@/lib/assistant/schema";

export type StartData = { greeting: string; suggestions: string[]; approval: boolean };

/** Display details the server resolves for a proposal card. */
export type CardDetail = {
  /** "sreda, 28. oktober, 18.30, Sv. Križ" */
  when: string;
  /** cancel_mass / add_intention: the Mass's intentions now. */
  intentions?: { kind: "deceased" | "thanksgiving" | "other"; text: string }[];
  /** Lesson cards: the group; event cards: the title; people cards: the person; approvals: the change. */
  name?: string;
  /** remove_intention: the intention's kind. */
  kind?: "deceased" | "thanksgiving" | "other";
  /** edit_event: the event as it is now. */
  before?: string;
  /** update_access: the person's access now. */
  sections?: Section[];
  requiresApproval?: boolean;
  /** approve_change / reject_change: who proposed it and when. */
  by?: string;
};

export type CardProposal = { proposal: Proposal; detail: CardDetail };

/** One assistant turn; `refused` when claude-pool was busy or failed. */
export type TurnData = { reply: string; cards: CardProposal[]; refused: boolean };
