/** Sections a helper can be given. "ljudje" (people & access) is owner-only. */
export const SECTIONS = ["mase", "oznanila", "dogodki", "verouk"] as const;
export type Section = (typeof SECTIONS)[number];
export type Area = Section | "ljudje";

export const SECTION_LABEL: Record<Section, string> = {
  mase: "Maše in nameni",
  oznanila: "Oznanila",
  dogodki: "Dogodki",
  verouk: "Verouk",
};

/** The signed-in person as every permission check sees them. */
export type Actor = {
  id: string;
  name: string;
  email: string;
  title: string;
  short: string;
  isOwner: boolean;
  requiresApproval: boolean;
  bigText: boolean;
  sections: Section[];
};

export function can(actor: Actor, area: Area): boolean {
  if (actor.isOwner) return true;
  if (area === "ljudje") return false;
  return actor.sections.includes(area);
}

/** Owners never need approval; helpers do when the owner chose so. */
export function needsApproval(actor: Actor): boolean {
  return !actor.isOwner && actor.requiresApproval;
}
