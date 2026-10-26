/** Slovenian labels for the fixed value lists shared with the Studio. */

export const EVENT_CATEGORY_LABEL: Record<string, string> = {
  liturgy: "Bogoslužje",
  feast: "Praznik",
  pilgrimage: "Romanje",
  catechesis: "Verouk",
  youth: "Mladi",
  families: "Družine",
  caritas: "Karitas",
  culture: "Kultura",
  meeting: "Srečanje",
  other: "Dogodek",
};

export const PERSON_ROLE_LABEL: Record<string, string> = {
  pastor: "Župnik",
  assistant: "Kaplan",
  helper: "Duhovni pomočnik",
  deacon: "Diakon",
  catechist: "Katehet",
  pastoral: "Pastoralni sodelavec",
  office: "Tajništvo",
  other: "Sodelavec",
};

export const SACRAMENT_KIND_LABEL: Record<string, string> = {
  baptism: "Krst",
  communion: "Prvo sveto obhajilo",
  confirmation: "Sveta birma",
  marriage: "Sveta poroka",
  confession: "Sveta spoved",
  anointing: "Bolniško maziljenje",
  funeral: "Pogreb",
};

export const CHURCH_KIND_LABEL: Record<string, string> = {
  parish: "Župnijska cerkev",
  filial: "Podružnična cerkev",
  chapel: "Kapela",
};

export const DOCUMENT_CATEGORY_LABEL: Record<string, string> = {
  forms: "Obrazci",
  catechesis: "Verouk",
  bulletins: "Oznanila",
  newsletter: "Župnijski list",
  info: "Pravila in informacije",
  other: "Drugo",
};

export const ANNOUNCEMENT_CATEGORY_LABEL: Record<string, string> = {
  notice: "Obvestilo",
  pastoral: "Pastoralno obvestilo",
  special: "Posebni termini",
  catechesis: "Verouk",
  caritas: "Karitas",
};

export const IMPORTANCE_LABEL: Record<string, string> = {
  normal: "Oznanilo",
  important: "Pomembno",
  urgent: "Nujno",
};

export const SEARCH_TYPE_LABEL: Record<string, string> = {
  announcement: "Oznanilo",
  event: "Dogodek",
  article: "Novica",
  page: "Stran",
  church: "Cerkev",
  sacrament: "Zakrament",
  parishGroup: "Skupina",
  gallery: "Galerija",
  parishDocument: "Dokument",
};

export function personRole(person: { role?: string | null; roleTitle?: string | null }): string {
  return person.roleTitle || PERSON_ROLE_LABEL[person.role ?? ""] || "";
}
