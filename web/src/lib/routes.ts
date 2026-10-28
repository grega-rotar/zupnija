/**
 * Every public URL on the site is built here so that a rename touches one
 * file. Slovenian paths are part of the product.
 */
export const routes = {
  home: "/",
  masses: "/svete-mase",
  intentions: "/masni-nameni",
  intentionsWeek: (weekStart: string) => `/masni-nameni?teden=${weekStart}`,
  announcements: "/oznanila",
  announcementsArchive: "/oznanila/arhiv",
  announcement: (slug: string) => `/oznanila/${slug}`,
  bulletin: (weekStart: string) => `/oznanila/teden/${weekStart}`,
  bulletins: "/oznanila/teden",
  /** The original PDF of a published bulletin (route: app/(site)/oznanila/[slug]/oznanila.pdf). */
  bulletinPdf: (periodStart: string) => `/oznanila/${periodStart}/oznanila.pdf`,
  events: "/dogodki",
  eventsArchive: "/dogodki/arhiv",
  event: (slug: string) => `/dogodki/${slug}`,
  news: "/novice",
  article: (slug: string) => `/novice/${slug}`,
  galleries: "/galerije",
  gallery: (slug: string) => `/galerije/${slug}`,
  parish: "/zupnija",
  churches: "/zupnija/cerkve",
  church: (slug: string) => `/zupnija/cerkve/${slug}`,
  people: "/zupnija/duhovniki",
  groups: "/zupnija/skupine",
  group: (slug: string) => `/zupnija/skupine/${slug}`,
  sacraments: "/zakramenti",
  sacrament: (slug: string) => `/zakramenti/${slug}`,
  catechesis: "/verouk",
  documents: "/dokumenti",
  contact: "/kontakt",
  search: "/iskanje",
  specialPeriod: (slug: string) => `/obdobje/${slug}`,
  page: (slug: string) => `/${slug}`,
} as const;

/** Maps a Sanity document type + slug to its public path. */
export function pathForDocument(type: string, slug: string | null | undefined): string | null {
  if (!slug) {
    switch (type) {
      case "homePage":
        return routes.home;
      case "catechesisPage":
      case "catechesisGroup":
        return routes.catechesis;
      case "parishDocument":
        return routes.documents;
      case "person":
        return routes.people;
      case "massSchedule":
      case "massDay":
        return routes.masses;
      default:
        return null;
    }
  }
  switch (type) {
    case "page":
      return routes.page(slug);
    case "event":
      return routes.event(slug);
    case "article":
      return routes.article(slug);
    case "church":
      return routes.church(slug);
    case "sacrament":
      return routes.sacrament(slug);
    case "parishGroup":
      return routes.group(slug);
    case "gallery":
      return routes.gallery(slug);
    case "announcement":
      return routes.announcement(slug);
    case "specialPeriod":
      return routes.specialPeriod(slug);
    default:
      return pathForDocument(type, null);
  }
}

/** Primary navigation. Deliberately shallow: Masses are one tap away. */
export type NavItem = { label: string; href: string; children?: { label: string; href: string; description?: string }[] };

export const navigation: NavItem[] = [
  { label: "Svete maše", href: routes.masses },
  { label: "Oznanila", href: routes.announcements },
  {
    label: "Dogajanje",
    href: routes.events,
    children: [
      { label: "Dogodki", href: routes.events, description: "Kaj se pripravlja" },
      { label: "Novice", href: routes.news, description: "Iz življenja župnije" },
      { label: "Galerije", href: routes.galleries, description: "Fotografije" },
      { label: "Mašni nameni", href: routes.intentions, description: "Po dnevih" },
    ],
  },
  {
    label: "Župnija",
    href: routes.parish,
    children: [
      { label: "O župniji", href: routes.parish },
      { label: "Cerkve", href: routes.churches },
      { label: "Duhovniki in sodelavci", href: routes.people },
      { label: "Skupine", href: routes.groups },
      { label: "Zakramenti", href: routes.sacraments },
      { label: "Dokumenti", href: routes.documents },
    ],
  },
  { label: "Verouk", href: routes.catechesis },
  { label: "Kontakt", href: routes.contact },
];
