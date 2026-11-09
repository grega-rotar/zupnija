/**
 * Website content types: one source for the editor's forms (vsebina/**)
 * and their validation (schemas.ts derives zod from these definitions).
 *
 * Mirrors studio/schemaTypes/** exactly: the same document types, field
 * names, nested objects (address, openingHours, link, faqItem, attachment,
 * seo, pageHeader) and page sections, so imported Sanity documents keep
 * their shape. Labels and help texts are the studio's.
 *
 * Kinds beyond the contract's list (all mirror a Sanity field type):
 * - "number"   Sanity number (order, limit);
 * - "strings"  an array of plain strings (no _key), e.g. a list of requirements;
 * - "images"   an array of imageWithAlt items (each with _key, _type "imageWithAlt");
 * - "geopoint" {_type:"geopoint", lat, lng}.
 * Extra keys: `when` shows a field only when a sibling has a value (link.internal
 * / link.href); a hidden field is never required. `after` on a date is the
 * sibling it must not precede. `initial` fills new documents ("@now"/"@today").
 */
import { formatDate } from "@/lib/dates";
import { pathForDocument } from "@/lib/routes";
import { ARRANGE_HEADING, SACRAMENT_TABS } from "@/lib/sacraments/tabs";

export const CONTENT_TYPES = [
  "settings",
  "homePage",
  "catechesisPage",
  "page",
  "article",
  "announcement",
  "gallery",
  "parishDocument",
  "specialPeriod",
  "church",
  "person",
  "parishGroup",
  "sacramentsPage",
  "massSchedule",
  "prayerPage",
  "donationPurpose",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
/** Reference targets: content types, plus Sanity types that now live in their own tables. */
export type RefTarget = ContentType | "event" | "massSchedule";

export const isContentType = (v: string): v is ContentType => (CONTENT_TYPES as readonly string[]).includes(v);

type Base = {
  name: string;
  label: string;
  help?: string;
  /** Sanity field group (TypeDef.groups); the form shows one titled group per name. */
  group?: string;
  /** Shown (and validated) only while the sibling `field` equals `is` (a select's value, or a switch's true). */
  when?: { field: string; is: string | boolean };
  /** Value for a new document. "@now" = current ISO datetime, "@today" = YYYY-MM-DD. */
  initial?: unknown;
};

export type Option = { value: string; label: string };

export type Field =
  | (Base & { kind: "string"; required?: boolean; max?: number; format?: "email" | "url"; pattern?: RegExp; patternMessage?: string })
  | (Base & { kind: "text"; rows?: number; max?: number; required?: boolean })
  | (Base & { kind: "slug"; source: string; max?: number; required?: boolean }) // {_type:"slug", current}
  | (Base & { kind: "date" | "datetime" | "time"; required?: boolean; after?: string })
  | (Base & { kind: "boolean" })
  | (Base & { kind: "number"; required?: boolean; min?: number; max?: number })
  | (Base & { kind: "select"; options: Option[]; required?: boolean; layout?: "radio" })
  /** imageWithAlt {_type:"imageWithAlt", asset:{_type:"reference",_ref}, alt, caption?, hotspot?, crop?}; `plain` = Sanity `image` (no alt/caption, _type "image"). */
  | (Base & { kind: "image"; required?: boolean; plain?: boolean })
  | (Base & { kind: "file"; accept?: string; required?: boolean }) // {_type:"file", asset:{_type:"reference",_ref}}
  | (Base & { kind: "richText"; variant: "full" | "simple"; required?: boolean }) // blockContent | simpleBlockContent
  /** One {_type:"reference", _ref}, or with `many` an array of them (each with _key). */
  | (Base & { kind: "reference"; to: RefTarget[]; many?: boolean; required?: boolean; min?: number })
  /** A nested object; `type` is the Sanity _type stamped on it (e.g. "address", "link"), absent for anonymous objects. */
  | (Base & { kind: "object"; type?: string; fields: Field[]; required?: boolean })
  /** Each item gets _key and _type (the chosen `of` entry's type). */
  | (Base & { kind: "array"; of: ArrayItem[]; required?: boolean; min?: number; max?: number; minMessage?: string })
  | (Base & { kind: "strings" })
  | (Base & { kind: "images"; required?: boolean; min?: number; minMessage?: string })
  | (Base & { kind: "geopoint" });

export type FieldKind = Field["kind"];
export type ArrayItem = { type: string; label: string; fields: Field[]; group?: string };

export type Doc = Record<string, unknown> & { _id?: string; _type?: string };

export type TypeDef = {
  type: ContentType;
  /** One document ("Novica"), the list ("Novice"), the create button ("Nova novica"). */
  label: string;
  plural: string;
  newLabel: string;
  area: "vsebina" | "zupnija" | "owner";
  singleton?: boolean;
  /** The list has a drag handle; order is the row's `sort` (and the doc's `order` field when it has one). */
  orderable?: boolean;
  titleField: string;
  /** List order for types that are not orderable (Sanity's default ordering). */
  orderBy?: { field: string; desc?: boolean };
  subtitle?: (doc: Doc) => string;
  groups?: { name: string; title: string }[];
  fields: Field[];
  /** For "Odpri na strani" / preview. */
  publicPath?: (doc: Doc) => string | null;
};

// ── Option lists (studio/lib/constants.ts) ─────────────────────────────────
const opts = (list: ReadonlyArray<readonly [string, string]>): Option[] => list.map(([value, label]) => ({ value, label }));

export const WEEKDAYS = opts([
  ["monday", "Ponedeljek"],
  ["tuesday", "Torek"],
  ["wednesday", "Sreda"],
  ["thursday", "Četrtek"],
  ["friday", "Petek"],
  ["saturday", "Sobota"],
  ["sunday", "Nedelja"],
]);
export const ANNOUNCEMENT_IMPORTANCE = opts([
  ["normal", "Običajno"],
  ["important", "Pomembno"],
  ["urgent", "Nujno"],
]);
export const ANNOUNCEMENT_CATEGORIES = opts([
  ["notice", "Obvestilo"],
  ["pastoral", "Pastoralno obvestilo"],
  ["special", "Posebni termini"],
  ["catechesis", "Verouk"],
  ["caritas", "Karitas"],
]);
export const PERSON_ROLES = opts([
  ["pastor", "Župnik"],
  ["assistant", "Kaplan"],
  ["helper", "Duhovni pomočnik"],
  ["deacon", "Diakon"],
  ["catechist", "Katehet / katehistinja"],
  ["pastoral", "Pastoralni sodelavec"],
  ["office", "Tajništvo"],
  ["other", "Drugo"],
]);
export const CHURCH_KINDS = opts([
  ["parish", "Župnijska cerkev"],
  ["filial", "Podružnična cerkev"],
  ["chapel", "Kapela"],
]);
export const DOCUMENT_CATEGORIES = opts([
  ["forms", "Obrazci"],
  ["catechesis", "Verouk"],
  ["bulletins", "Oznanila"],
  ["newsletter", "Župnijski list"],
  ["info", "Pravila in informacije"],
  ["other", "Drugo"],
]);
export const LITURGICAL_SEASONS = opts([
  ["none", "Brez posebnega poudarka"],
  ["advent", "Advent (vijolična)"],
  ["christmas", "Božič (zlata)"],
  ["lent", "Post (vijolična)"],
  ["easter", "Velika noč (bela)"],
  ["pentecost", "Binkošti (rdeča)"],
  ["marian", "Marijin praznik (modra)"],
]);

/** The groups' card icons (src/components/groups/icons/<value>.svg, from ZUP-13's skupine-ikone-v3). */
export const GROUP_ICONS = opts([
  ["zupnijski-pastoralni-svet", "Župnijski pastoralni svet"],
  ["zupnijska-karitas", "Župnijska Karitas"],
  ["molitvena-skupina", "Molitvena skupina"],
  ["zakonska-skupina", "Zakonska skupina"],
  ["mladinska-skupina", "Mladinska skupina"],
  ["ministranti", "Ministranti"],
  ["bralci-bozje-besede", "Bralci Božje besede"],
  ["pritrkovalci", "Pritrkovalci"],
  ["mladinski-pevski-zbor", "Mladinski pevski zbor"],
  ["otroski-pevski-zbor", "Otroški pevski zbor"],
  ["odrasli-pevski-zbor", "Odrasli pevski zbor"],
  ["krasilci", "Krasilci"],
  ["oratorijski-animatorji", "Oratorijski animatorji"],
  ["verouk", "Verouk"],
  ["oratorij", "Oratorij"],
]);

/** Where a prayer request goes when the group names no address (ZUP-25). */
export const PRAYER_EMAIL_DEFAULT = "zupirnice@gmail.com";

export const labelOf = (list: Option[], v: unknown) => list.find((o) => o.value === v)?.label;

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const SCHOOL_YEAR = /^\d{4}\/\d{4}$/;
const EMAIL_MSG = "Vnesite veljaven e-poštni naslov.";

// ── Objects (studio/schemaTypes/objects) ───────────────────────────────────
const address = (name: string, label: string, group?: string): Field => ({
  kind: "object",
  type: "address",
  name,
  label,
  group,
  fields: [
    { kind: "string", name: "street", label: "Ulica in hišna številka" },
    { kind: "string", name: "postalCode", label: "Poštna številka" },
    { kind: "string", name: "city", label: "Kraj" },
  ],
});

const LINK_FIELDS: Field[] = [
  { kind: "string", name: "label", label: "Besedilo povezave", required: true, max: 60 },
  {
    kind: "select",
    name: "kind",
    label: "Vrsta povezave",
    layout: "radio",
    required: true,
    initial: "internal",
    options: opts([
      ["internal", "Stran na tej spletni strani"],
      ["external", "Zunanja spletna povezava"],
    ]),
  },
  {
    kind: "reference",
    name: "internal",
    label: "Stran",
    to: ["page", "event", "article", "church", "parishGroup", "gallery", "announcement"],
    when: { field: "kind", is: "internal" },
    required: true,
  },
  { kind: "string", name: "href", label: "Spletni naslov", help: "Vključno s https://", format: "url", when: { field: "kind", is: "external" }, required: true },
];
const link = (name: string, label: string, extra: Partial<Base> & { required?: boolean } = {}): Field => ({
  kind: "object",
  type: "link",
  name,
  label,
  fields: LINK_FIELDS,
  ...extra,
});
const LINK_ITEM: ArrayItem = { type: "link", label: "Povezava", fields: LINK_FIELDS };

const ATTACHMENT_ITEM: ArrayItem = {
  type: "attachment",
  label: "Priponka",
  fields: [
    { kind: "string", name: "title", label: "Naslov", required: true },
    { kind: "file", name: "file", label: "Datoteka", accept: ".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.jpg,.jpeg,.png", required: true },
  ],
};
const attachments = (group?: string): Field => ({ kind: "array", name: "attachments", label: "Priponke", group, of: [ATTACHMENT_ITEM] });

const FAQ_ITEM: ArrayItem = {
  type: "faqItem",
  label: "Vprašanje in odgovor",
  fields: [
    { kind: "string", name: "question", label: "Vprašanje", required: true },
    { kind: "richText", name: "answer", label: "Odgovor", variant: "simple", required: true },
  ],
};

const OPENING_HOURS_ITEM: ArrayItem = {
  type: "openingHours",
  label: "Uradne ure",
  fields: [
    { kind: "select", name: "weekday", label: "Dan", options: WEEKDAYS, required: true },
    { kind: "string", name: "from", label: "Od", help: "Ura v obliki 16:00", required: true, pattern: TIME, patternMessage: "Vnesite uro v obliki 16:00" },
    { kind: "string", name: "to", label: "Do", help: "Ura v obliki 18:00", required: true, pattern: TIME, patternMessage: "Vnesite uro v obliki 18:00" },
    { kind: "string", name: "note", label: "Opomba", help: "Neobvezno, npr. »po sveti maši« ali »samo po dogovoru«." },
  ],
};

const seo = (label = "Iskalniki in deljenje", group?: string, help?: string): Field => ({
  kind: "object",
  type: "seo",
  name: "seo",
  label,
  group,
  help,
  fields: [
    { kind: "string", name: "title", label: "Naslov za iskalnike", help: "Neobvezno. Če je prazno, se uporabi naslov vsebine.", max: 70 },
    { kind: "text", name: "description", label: "Kratek opis za iskalnike", rows: 3, help: "Neobvezno. Ena ali dve povedi, ki opišeta vsebino strani.", max: 170 },
    { kind: "image", name: "image", label: "Slika za deljenje", plain: true, help: "Neobvezno. Uporabi se pri deljenju na družbenih omrežjih (priporočeno 1200 × 630)." },
    { kind: "boolean", name: "noIndex", label: "Skrij pred iskalniki", help: "Vklopi samo izjemoma (npr. začasne ali interne strani).", initial: false },
  ],
});

const pageHeader = (name: string, title: string): Field => ({
  kind: "object",
  type: "pageHeader",
  name,
  label: `Glava strani: ${title}`,
  group: "headers",
  fields: [
    // Only the photo: the header shows the breadcrumbs and the title, no subline or quotation (ZUP-14).
    { kind: "image", name: "image", label: "Fotografija", help: "Vodoravna fotografija za ozadje naslova. Brez nje ima stran svetlo glavo." },
  ],
});

const slug = (source: string, max: number, group?: string, help?: string): Field => ({
  kind: "slug",
  name: "slug",
  label: "Spletni naslov",
  source,
  max,
  group,
  help,
  required: true,
});

// ── Page sections (studio/schemaTypes/sections) ────────────────────────────
/** The studio's insert-menu groups, in its order (ArrayItem.group). */
export const SECTION_GROUPS = ["Besedilo", "Slike", "Iz župnijskih podatkov", "Poziv"];

export const SECTION_ITEMS: ArrayItem[] = [
  {
    type: "sectionHero",
    label: "Naslovna slika",
    group: "Slike",
    fields: [
      { kind: "image", name: "image", label: "Slika", required: true },
      { kind: "string", name: "title", label: "Naslov" },
      { kind: "text", name: "text", label: "Besedilo", rows: 2, max: 240 },
    ],
  },
  {
    type: "sectionRichText",
    label: "Besedilo",
    group: "Besedilo",
    fields: [
      { kind: "string", name: "title", label: "Naslov" },
      { kind: "richText", name: "body", label: "Besedilo", variant: "full", required: true },
    ],
  },
  {
    type: "sectionTextImage",
    label: "Besedilo in slika",
    group: "Besedilo",
    fields: [
      { kind: "string", name: "title", label: "Naslov" },
      { kind: "richText", name: "body", label: "Besedilo", variant: "simple", required: true },
      { kind: "image", name: "image", label: "Slika", required: true },
      {
        kind: "select",
        name: "imageSide",
        label: "Slika je",
        layout: "radio",
        initial: "right",
        options: opts([
          ["right", "Desno"],
          ["left", "Levo"],
        ]),
      },
      link("link", "Povezava"),
    ],
  },
  {
    type: "sectionQuote",
    label: "Citat",
    group: "Besedilo",
    fields: [
      { kind: "text", name: "quote", label: "Besedilo", rows: 3, required: true, max: 400 },
      { kind: "string", name: "source", label: "Vir", help: "Npr. »Mt 5,9« ali »papež Frančišek«." },
    ],
  },
  {
    type: "sectionGallery",
    label: "Galerija",
    group: "Slike",
    fields: [
      { kind: "string", name: "title", label: "Naslov" },
      { kind: "reference", name: "gallery", label: "Obstoječa galerija", to: ["gallery"], help: "Izberite galerijo ali spodaj dodajte fotografije samo za to stran." },
      { kind: "images", name: "images", label: "Fotografije" },
    ],
  },
  {
    type: "sectionPeople",
    label: "Osebe",
    group: "Iz župnijskih podatkov",
    fields: [
      { kind: "string", name: "title", label: "Naslov" },
      { kind: "reference", name: "people", label: "Osebe", to: ["person"], many: true, required: true, min: 1 },
    ],
  },
  {
    type: "sectionChurches",
    label: "Cerkve",
    group: "Iz župnijskih podatkov",
    fields: [
      { kind: "string", name: "title", label: "Naslov", initial: "Naše cerkve" },
      { kind: "reference", name: "churches", label: "Cerkve", to: ["church"], many: true, help: "Pustite prazno za prikaz vseh cerkva." },
    ],
  },
  {
    type: "sectionFaq",
    label: "Pogosta vprašanja",
    group: "Besedilo",
    fields: [
      { kind: "string", name: "title", label: "Naslov", initial: "Pogosta vprašanja" },
      { kind: "array", name: "items", label: "Vprašanja", of: [FAQ_ITEM], required: true, min: 1 },
    ],
  },
  {
    type: "sectionDocuments",
    label: "Dokumenti",
    group: "Iz župnijskih podatkov",
    fields: [
      { kind: "string", name: "title", label: "Naslov", initial: "Dokumenti" },
      { kind: "reference", name: "documents", label: "Dokumenti", to: ["parishDocument"], many: true, required: true, min: 1 },
    ],
  },
  {
    type: "sectionContact",
    label: "Kontakt",
    group: "Iz župnijskih podatkov",
    fields: [
      { kind: "string", name: "title", label: "Naslov", initial: "Kontakt" },
      { kind: "boolean", name: "showForm", label: "Prikaži kontaktni obrazec", help: "Prikaže kontaktne podatke in uradne ure iz nastavitev župnije.", initial: false },
    ],
  },
  {
    type: "sectionEvents",
    label: "Prihajajoči dogodki",
    group: "Iz župnijskih podatkov",
    fields: [
      { kind: "string", name: "title", label: "Naslov", initial: "Prihajajoči dogodki" },
      { kind: "number", name: "limit", label: "Največ dogodkov", min: 1, max: 12, initial: 4 },
    ],
  },
  {
    type: "sectionMassSchedule",
    label: "Urnik svetih maš",
    group: "Iz župnijskih podatkov",
    fields: [
      { kind: "string", name: "title", label: "Naslov", initial: "Svete maše" },
      { kind: "reference", name: "church", label: "Samo za cerkev", to: ["church"], help: "Neobvezno. Pustite prazno za vse cerkve." },
    ],
  },
  {
    type: "sectionCta",
    label: "Poziv s povezavo",
    group: "Poziv",
    fields: [
      { kind: "string", name: "title", label: "Naslov", required: true },
      { kind: "text", name: "text", label: "Besedilo", rows: 2, max: 240 },
      link("link", "Povezava", { required: true }),
    ],
  },
];

// ── Helpers for list subtitles and public paths ────────────────────────────
const str = (v: unknown) => (typeof v === "string" ? v : "");
const slugOf = (d: Doc) => str((d.slug as { current?: string } | undefined)?.current) || null;
const day = (v: unknown) => (str(v) ? formatDate(str(v).slice(0, 10)) : "");
const join = (...parts: unknown[]) => parts.filter((p) => typeof p === "string" && p).join(" · ");
const pathFor = (type: ContentType) => (d: Doc) => pathForDocument(type, slugOf(d));

// ── Documents (studio/schemaTypes/documents) ───────────────────────────────
export const TYPES: Record<ContentType, TypeDef> = {
  settings: {
    type: "settings",
    label: "Nastavitve župnije",
    plural: "Nastavitve",
    newLabel: "Nastavitve",
    area: "owner",
    singleton: true,
    titleField: "name",
    groups: [
      { name: "parish", title: "Župnija" },
      { name: "contact", title: "Kontakt in uradne ure" },
      { name: "donations", title: "Darovi" },
      { name: "web", title: "Spletna stran" },
      { name: "headers", title: "Glave strani" },
    ],
    fields: [
      { kind: "string", name: "name", label: "Ime župnije", group: "parish", required: true, initial: "Župnija Pirniče" },
      { kind: "text", name: "tagline", label: "Kratek opis župnije", rows: 2, group: "parish", max: 200, help: "Ena poved, ki se prikaže v nogi in pri deljenju na družbenih omrežjih." },
      { kind: "string", name: "diocese", label: "Škofija / dekanija", group: "parish", help: "Npr. »Nadškofija Ljubljana, dekanija Ljubljana - Šentvid«." },
      { kind: "reference", name: "pastor", label: "Župnik", to: ["person"], group: "parish" },
      address("address", "Naslov župnišča", "contact"),
      { kind: "string", name: "phone", label: "Telefon", group: "contact" },
      { kind: "string", name: "mobile", label: "Mobilni telefon", group: "contact" },
      { kind: "string", name: "email", label: "E-pošta", group: "contact", format: "email", patternMessage: EMAIL_MSG },
      {
        kind: "string",
        name: "contactFormRecipient",
        label: "Prejemnik sporočil s spletnega obrazca",
        group: "contact",
        format: "email",
        patternMessage: EMAIL_MSG,
        help: "E-poštni naslov, kamor prispejo sporočila s kontaktnega obrazca. Ni javno prikazan.",
      },
      { kind: "array", name: "officeHours", label: "Uradne ure", group: "contact", of: [OPENING_HOURS_ITEM] },
      { kind: "richText", name: "officeHoursNote", label: "Opomba k uradnim uram", variant: "simple", group: "contact", help: "Npr. »Ob praznikih uradnih ur ni. Za nujne primere pokličite.«" },
      {
        kind: "object",
        name: "emergencyContact",
        label: "Nujni primeri",
        group: "contact",
        help: "Prikazano pri kontaktu in pri bolniškem maziljenju / pogrebu.",
        fields: [
          { kind: "string", name: "label", label: "Besedilo", initial: "Za bolniško maziljenje in pogreb" },
          { kind: "string", name: "phone", label: "Telefon" },
        ],
      },
      {
        kind: "array",
        name: "socialLinks",
        label: "Družbena omrežja",
        group: "contact",
        of: [
          {
            type: "socialLink",
            label: "Omrežje",
            fields: [
              {
                kind: "select",
                name: "platform",
                label: "Omrežje",
                required: true,
                options: opts([
                  ["facebook", "Facebook"],
                  ["instagram", "Instagram"],
                  ["youtube", "YouTube"],
                  ["other", "Drugo"],
                ]),
              },
              { kind: "string", name: "label", label: "Ime (za »Drugo«)" },
              { kind: "string", name: "url", label: "Povezava", format: "url", required: true },
            ],
          },
        ],
      },
      {
        kind: "object",
        name: "donations",
        label: "Darovi za župnijo",
        group: "donations",
        fields: [
          { kind: "richText", name: "intro", label: "Besedilo", variant: "simple" },
          { kind: "string", name: "recipient", label: "Prejemnik" },
          { kind: "string", name: "iban", label: "IBAN" },
          { kind: "string", name: "bic", label: "BIC / SWIFT" },
          { kind: "string", name: "reference", label: "Sklic" },
          { kind: "string", name: "purpose", label: "Namen nakazila", initial: "Dar za župnijo" },
        ],
      },
      pageHeader("massesHeader", "Svete maše"),
      pageHeader("announcementsHeader", "Oznanila"),
      pageHeader("eventsHeader", "Dogodki"),
      pageHeader("parishHeader", "Župnija"),
      pageHeader("catechesisHeader", "Verouk"),
      pageHeader("contactHeader", "Kontakt"),
      {
        kind: "string",
        name: "siteUrl",
        label: "Naslov spletne strani",
        group: "web",
        format: "url",
        help: "Npr. https://zupnija-pirnice.si — uporabi se pri deljenju in v zemljevidu strani.",
      },
      seo("Privzete nastavitve za iskalnike", "web", "Uporabijo se, kadar posamezna vsebina nima svojih nastavitev."),
      { kind: "richText", name: "footerText", label: "Besedilo v nogi", variant: "simple", group: "web", help: "Neobvezno, npr. kratka misel ali navedba avtorstva fotografij." },
      { kind: "reference", name: "privacyPage", label: "Stran z izjavo o zasebnosti", to: ["page"], group: "web" },
      { kind: "reference", name: "legalPage", label: "Stran s pravnimi informacijami", to: ["page"], group: "web" },
    ],
    publicPath: () => "/kontakt",
  },

  homePage: {
    type: "homePage",
    label: "Domača stran",
    plural: "Domača stran",
    newLabel: "Domača stran",
    area: "vsebina",
    singleton: true,
    titleField: "heroTitle",
    fields: [
      { kind: "image", name: "heroImage", label: "Glavna fotografija", required: true, help: "Velika fotografija na vrhu domače strani. Najbolje vodoravna, cerkev ali kraj." },
      // The photo carries only the title (ZUP-10): no line above it, no text or quotation under it.
      { kind: "string", name: "heroTitle", label: "Naslov", max: 60, help: "Če je prazno, se uporabi ime župnije." },
      { kind: "text", name: "heroText", label: "Kratek opis domače strani", rows: 3, max: 240, help: "Za iskalnike in deljenje, kadar opis za iskalnike ni vpisan. Na strani se ne prikaže." },
      {
        kind: "object",
        name: "tile",
        label: "Slika z mislijo na domači strani",
        help: "Neobvezno. Slika s kratko mislijo poleg današnjih maš in tedenskih oznanil.",
        fields: [
          { kind: "image", name: "image", label: "Slika" },
          { kind: "text", name: "text", label: "Misel", rows: 2, max: 160 },
          { kind: "string", name: "source", label: "Vir", max: 40 },
        ],
      },
      {
        kind: "object",
        name: "welcome",
        label: "Nagovor",
        help: "Neobvezen daljši nagovor župnika ali predstavitev župnije na domači strani.",
        fields: [
          { kind: "string", name: "title", label: "Naslov" },
          { kind: "richText", name: "text", label: "Besedilo", variant: "simple" },
          { kind: "image", name: "image", label: "Slika" },
          link("link", "Povezava"),
        ],
      },
      {
        kind: "array",
        name: "featuredLinks",
        label: "Poudarjene povezave",
        help: "Neobvezno. Do štiri povezave, ki so trenutno pomembne (npr. verouk, prijave, romanje).",
        of: [LINK_ITEM],
        max: 4,
      },
      seo(),
    ],
    publicPath: () => "/",
  },

  catechesisPage: {
    type: "catechesisPage",
    label: "Verouk — splošno",
    plural: "Verouk (stran)",
    newLabel: "Verouk (stran)",
    area: "zupnija",
    singleton: true,
    titleField: "title",
    subtitle: (d) => str(d.schoolYear),
    fields: [
      { kind: "string", name: "title", label: "Naslov strani", required: true, initial: "Verouk" },
      {
        kind: "string",
        name: "schoolYear",
        label: "Tekoče veroučno leto",
        help: "Npr. »2026/2027«. Prikazane so skupine tega leta.",
        required: true,
        pattern: SCHOOL_YEAR,
        patternMessage: "Oblika: 2026/2027",
      },
      { kind: "richText", name: "intro", label: "Uvod", variant: "full", help: "Kaj je verouk, kdo je vabljen, kdaj se začne." },
      { kind: "richText", name: "enrollment", label: "Vpis", variant: "full", help: "Kako in kdaj se vpisati, kaj prinesti." },
      { kind: "reference", name: "contact", label: "Kontaktna oseba", to: ["person"] },
      { kind: "reference", name: "documents", label: "Dokumenti", to: ["parishDocument"], many: true, help: "Prijavnice, urniki v PDF, pravila." },
      {
        kind: "richText",
        name: "notice",
        label: "Aktualno obvestilo",
        variant: "simple",
        help: "Kratko obvestilo na vrhu strani, npr. »Ta teden verouka ni.« Izbrišite, ko ni več aktualno.",
      },
      { kind: "image", name: "image", label: "Slika" },
      seo(),
    ],
    publicPath: () => "/verouk",
  },

  page: {
    type: "page",
    label: "Stran",
    plural: "Strani",
    newLabel: "Nova stran",
    area: "vsebina",
    titleField: "title",
    orderBy: { field: "title" },
    subtitle: (d) => (slugOf(d) ? `/${slugOf(d)}` : ""),
    fields: [
      { kind: "string", name: "title", label: "Naslov strani", required: true, max: 100 },
      slug("title", 80, undefined, "Del naslova za zadnjo poševnico, npr. »o-zupniji« → zupnija-pirnice.si/o-zupniji"),
      { kind: "text", name: "intro", label: "Uvodno besedilo", rows: 3, max: 300, help: "Neobvezno. Prikazano pod naslovom." },
      { kind: "array", name: "sections", label: "Odseki", of: SECTION_ITEMS },
      seo(),
    ],
    publicPath: pathFor("page"),
  },

  article: {
    type: "article",
    label: "Novica",
    plural: "Novice",
    newLabel: "Nova novica",
    area: "vsebina",
    titleField: "title",
    orderBy: { field: "publishedAt", desc: true },
    subtitle: (d) => day(d.publishedAt),
    groups: [
      { name: "content", title: "Vsebina" },
      { name: "meta", title: "Podrobnosti" },
      { name: "seo", title: "Iskalniki" },
    ],
    fields: [
      { kind: "string", name: "title", label: "Naslov", group: "content", required: true, max: 140 },
      slug("title", 96, "content"),
      { kind: "text", name: "excerpt", label: "Povzetek", rows: 3, group: "content", required: true, max: 300, help: "Dve ali tri povedi. Prikazano v seznamih in pri deljenju." },
      { kind: "image", name: "image", label: "Glavna slika", group: "content" },
      { kind: "richText", name: "body", label: "Besedilo", variant: "full", group: "content", required: true },
      { kind: "reference", name: "gallery", label: "Galerija", to: ["gallery"], group: "content", help: "Neobvezno. Povezana galerija se prikaže pod novico." },
      { kind: "datetime", name: "publishedAt", label: "Datum objave", group: "meta", required: true, initial: "@now" },
      { kind: "reference", name: "author", label: "Avtor", to: ["person"], group: "meta", help: "Neobvezno." },
      { kind: "reference", name: "relatedEvent", label: "Povezan dogodek", to: ["event"], group: "meta" },
      attachments("meta"),
      seo("Iskalniki in deljenje", "seo"),
    ],
    publicPath: pathFor("article"),
  },

  announcement: {
    type: "announcement",
    label: "Obvestilo",
    plural: "Obvestila",
    newLabel: "Novo obvestilo",
    area: "vsebina",
    titleField: "title",
    orderBy: { field: "publishFrom", desc: true },
    subtitle: (d) => {
      const expired = str(d.publishUntil) && new Date(str(d.publishUntil)) < new Date();
      const level = labelOf(ANNOUNCEMENT_IMPORTANCE, d.importance);
      return join(expired ? "poteklo" : level !== "Običajno" ? level : null, day(d.publishFrom));
    },
    fields: [
      { kind: "string", name: "title", label: "Naslov", required: true, max: 120 },
      slug("title", 80),
      { kind: "select", name: "category", label: "Vrsta", options: ANNOUNCEMENT_CATEGORIES, initial: "notice" },
      { kind: "image", name: "image", label: "Slika", help: "Neobvezno. Prikazana ob oznanilu v seznamu." },
      {
        kind: "select",
        name: "importance",
        label: "Pomembnost",
        options: ANNOUNCEMENT_IMPORTANCE,
        layout: "radio",
        initial: "normal",
        help: "»Nujno« se prikaže v opozorilnem traku na vrhu strani. Uporabite redko.",
      },
      { kind: "text", name: "summary", label: "Povzetek", rows: 2, required: true, max: 240, help: "Ena ali dve povedi. Prikazano na domači strani in v seznamih." },
      { kind: "richText", name: "body", label: "Besedilo", variant: "full" },
      { kind: "datetime", name: "publishFrom", label: "Objavljeno od", required: true, initial: "@now" },
      {
        kind: "datetime",
        name: "publishUntil",
        label: "Objavljeno do",
        after: "publishFrom",
        help: "Po tem datumu oznanilo izgine z domače strani in aktualnih seznamov, ostane pa v arhivu.",
      },
      { kind: "boolean", name: "showOnHomepage", label: "Prikaži na domači strani", initial: true },
      link("cta", "Gumb (neobvezno)", { help: "Npr. »Prijavnica« ali »Več o romanju«." }),
      { kind: "reference", name: "relatedEvent", label: "Povezan dogodek", to: ["event"] },
      attachments(),
    ],
    publicPath: pathFor("announcement"),
  },

  gallery: {
    type: "gallery",
    label: "Galerija",
    plural: "Galerije",
    newLabel: "Nova galerija",
    area: "vsebina",
    titleField: "title",
    orderBy: { field: "date", desc: true },
    subtitle: (d) => `${day(d.date)} · ${Array.isArray(d.images) ? d.images.length : 0} fotografij`,
    fields: [
      { kind: "string", name: "title", label: "Naslov", required: true, max: 120 },
      slug("title", 96),
      { kind: "date", name: "date", label: "Datum", required: true, initial: "@today" },
      { kind: "richText", name: "description", label: "Opis", variant: "simple" },
      {
        kind: "images",
        name: "images",
        label: "Fotografije",
        required: true,
        min: 1,
        minMessage: "Dodajte vsaj eno fotografijo.",
        help: "Povlecite več fotografij hkrati v to polje. Vrstni red lahko spremenite z vlečenjem. Prva fotografija je naslovna, če ni izbrana druga.",
      },
      { kind: "image", name: "cover", label: "Naslovna fotografija", help: "Neobvezno. Če je prazno, se uporabi prva fotografija." },
      { kind: "reference", name: "relatedEvent", label: "Povezan dogodek", to: ["event"] },
      { kind: "string", name: "photographer", label: "Avtor fotografij" },
    ],
    publicPath: pathFor("gallery"),
  },

  parishDocument: {
    type: "parishDocument",
    label: "Dokument",
    plural: "Dokumenti",
    newLabel: "Nov dokument",
    area: "vsebina",
    titleField: "title",
    orderBy: { field: "date", desc: true },
    subtitle: (d) => join(labelOf(DOCUMENT_CATEGORIES, d.category), day(d.date)),
    fields: [
      { kind: "string", name: "title", label: "Naslov", required: true, max: 120 },
      { kind: "file", name: "file", label: "Datoteka", accept: ".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods", required: true },
      { kind: "select", name: "category", label: "Vrsta", options: DOCUMENT_CATEGORIES, required: true, initial: "other" },
      { kind: "date", name: "date", label: "Datum", initial: "@today" },
      { kind: "text", name: "description", label: "Opis", rows: 2, max: 240 },
      {
        kind: "boolean",
        name: "public",
        label: "Prikazano na spletni strani",
        initial: true,
        help: "Izklopite, če želite dokument hraniti, a ga ne prikazati v seznamu dokumentov.",
      },
    ],
    publicPath: pathFor("parishDocument"),
  },

  specialPeriod: {
    type: "specialPeriod",
    label: "Posebno obdobje",
    plural: "Posebna obdobja",
    newLabel: "Novo obdobje",
    area: "vsebina",
    titleField: "title",
    orderBy: { field: "activeFrom", desc: true },
    subtitle: (d) => `${day(d.activeFrom)} – ${day(d.activeUntil)}`,
    fields: [
      { kind: "string", name: "title", label: "Naslov", required: true, help: "Npr. »Božič 2026«, »Postni čas«, »Farno žegnanje«." },
      slug("title", 80),
      { kind: "date", name: "activeFrom", label: "Prikazano od", required: true },
      { kind: "date", name: "activeUntil", label: "Prikazano do (vključno)", required: true, after: "activeFrom" },
      {
        kind: "select",
        name: "season",
        label: "Liturgični poudarek",
        options: LITURGICAL_SEASONS,
        initial: "none",
        help: "Doda nežen barvni poudarek. Spletna stran ostane berljiva in umirjena.",
      },
      { kind: "image", name: "image", label: "Slika" },
      { kind: "richText", name: "message", label: "Sporočilo", variant: "full", help: "Voščilo, vabilo, program obredov …" },
      {
        kind: "reference",
        name: "schedule",
        label: "Poseben urnik svetih maš",
        to: ["massSchedule"],
        help: "Neobvezno. Urnik se prikaže na strani obdobja. Za dejanske spremembe maš na posamezne dneve uporabite »Mašne dneve«.",
      },
      {
        kind: "string",
        name: "officeHoursNote",
        label: "Spremenjene uradne ure",
        help: "Npr. »Med prazniki uradnih ur ni.« Prikazano pri kontaktu, dokler je obdobje aktivno.",
      },
      { kind: "reference", name: "events", label: "Povezani dogodki", to: ["event"], many: true },
      { kind: "reference", name: "announcements", label: "Povezana oznanila", to: ["announcement"], many: true },
      attachments(),
    ],
    publicPath: pathFor("specialPeriod"),
  },

  church: {
    type: "church",
    label: "Cerkev",
    plural: "Cerkve",
    newLabel: "Nova cerkev",
    area: "zupnija",
    orderable: true,
    titleField: "name",
    subtitle: (d) => join(labelOf(CHURCH_KINDS, d.kind), str(d.dedication)),
    groups: [
      { name: "basic", title: "Osnovno" },
      { name: "content", title: "Opis in zgodovina" },
      { name: "visit", title: "Obisk in dostop" },
      { name: "media", title: "Slike" },
      { name: "seo", title: "Iskalniki" },
    ],
    fields: [
      { kind: "string", name: "name", label: "Ime cerkve", group: "basic", required: true, help: "Npr. »Župnijska cerkev sv. Križa«" },
      {
        kind: "string",
        name: "shortName",
        label: "Kratko ime",
        group: "basic",
        required: true,
        max: 30,
        help: "Ime, ki ga stran prikazuje povsod: na karticah, v urnikih maš in na strani cerkve, npr. »Cerkev sv. Križa«.",
      },
      slug("name", 80, "basic"),
      { kind: "select", name: "kind", label: "Vrsta", group: "basic", options: CHURCH_KINDS, layout: "radio", required: true, initial: "filial" },
      { kind: "string", name: "dedication", label: "Posvečena", group: "basic", help: "Zavetnik ali skrivnost, npr. »sv. Križ« ali »Marijino vnebovzetje«." },
      { kind: "string", name: "patronFeast", label: "Žegnanje / farni praznik", group: "basic", help: "Npr. »14. september« ali »nedelja po 15. avgustu«." },
      { kind: "number", name: "order", label: "Vrstni red", group: "basic", initial: 10, help: "Manjša številka je prikazana prej. Župnijska cerkev naj bo 1." },
      { kind: "text", name: "summary", label: "Kratek opis", rows: 3, group: "content", max: 300, help: "Dve ali tri povedi za sezname in domačo stran." },
      { kind: "richText", name: "description", label: "Opis", variant: "full", group: "content" },
      { kind: "richText", name: "history", label: "Zgodovina", variant: "full", group: "content" },
      address("address", "Naslov", "visit"),
      { kind: "geopoint", name: "location", label: "Lokacija na zemljevidu", group: "visit", help: "Uporabi se za povezavo do zemljevida in navigacije." },
      { kind: "richText", name: "accessibility", label: "Dostopnost", variant: "simple", group: "visit", help: "Dostop za invalidske vozičke, stopnice, indukcijska zanka …" },
      { kind: "richText", name: "parking", label: "Parkiranje", variant: "simple", group: "visit" },
      { kind: "richText", name: "visitNotes", label: "Opombe za obiskovalce", variant: "simple", group: "visit", help: "Npr. kdaj je cerkev odprta, kje dobiti ključ." },
      { kind: "image", name: "image", label: "Glavna slika", group: "media" },
      { kind: "images", name: "gallery", label: "Galerija", group: "media" },
      seo("Iskalniki in deljenje", "seo"),
    ],
    publicPath: pathFor("church"),
  },

  person: {
    type: "person",
    label: "Oseba",
    plural: "Duhovniki in sodelavci",
    newLabel: "Nova oseba",
    area: "zupnija",
    orderable: true,
    titleField: "name",
    subtitle: (d) => str(d.roleTitle) || labelOf(PERSON_ROLES, d.role) || "",
    fields: [
      {
        kind: "string",
        name: "name",
        label: "Ime in priimek",
        required: true,
        help: "Z nazivom, če je primerno, npr. »Janez Novak, župnik« se zapiše samo »Janez Novak«.",
      },
      slug("name", 80),
      { kind: "select", name: "role", label: "Vloga", options: PERSON_ROLES, required: true },
      { kind: "string", name: "roleTitle", label: "Naziv (prikazano)", help: "Neobvezno. Če želite drugačen zapis od izbrane vloge, npr. »župnik in dekan«." },
      { kind: "image", name: "photo", label: "Fotografija" },
      { kind: "richText", name: "bio", label: "Predstavitev", variant: "simple" },
      { kind: "string", name: "email", label: "E-pošta", format: "email", patternMessage: EMAIL_MSG },
      { kind: "string", name: "phone", label: "Telefon" },
      { kind: "boolean", name: "showContact", label: "Prikaži kontakt na spletni strani", initial: true },
      { kind: "number", name: "order", label: "Vrstni red", initial: 10, help: "Manjša številka je prikazana prej." },
    ],
    publicPath: pathFor("person"),
  },

  parishGroup: {
    type: "parishGroup",
    label: "Skupina",
    plural: "Skupine",
    newLabel: "Nova skupina",
    area: "zupnija",
    orderable: true,
    titleField: "title",
    subtitle: (d) => str(d.href) || str(d.meetingSchedule),
    fields: [
      {
        kind: "string",
        name: "title",
        label: "Ime skupine",
        required: true,
        max: 80,
        help: "Npr. »Mešani pevski zbor«, »Ministranti«, »Župnijska Karitas«.",
      },
      slug("title", 80),
      { kind: "select", name: "icon", label: "Ikona", options: GROUP_ICONS, help: "Prikazana na kartici v seznamu skupin in na strani skupine." },
      { kind: "image", name: "cardImage", label: "Fotografija na kartici", help: "Neobvezno. Na kartici v seznamu skupin se prikaže namesto ikone." },
      {
        kind: "string",
        name: "href",
        label: "Kartica vodi na",
        pattern: /^\/[a-z0-9\-/]*$/,
        patternMessage: "Vpišite pot na tej strani, npr. »/verouk«.",
        help: "Neobvezno. Za skupino, ki ima svojo stran drugje, npr. »/verouk«. Sicer kartica vodi na stran skupine.",
      },
      { kind: "text", name: "summary", label: "Kratek opis", rows: 2, max: 200, help: "Ena ali dve povedi za iskalnik in deljenje na družbenih omrežjih." },
      { kind: "richText", name: "description", label: "Predstavitev", variant: "full" },
      { kind: "string", name: "meetingSchedule", label: "Kdaj se srečujemo", help: "Npr. »Vsak četrtek ob 19.30« ali »Po dogovoru«." },
      { kind: "string", name: "location", label: "Kje", help: "Npr. »Župnijska dvorana« ali »Cerkev sv. Križa«." },
      {
        kind: "boolean",
        name: "hideJoin",
        label: "Skrij razdelek »Pridružite se«",
        help: "Za skupine, ki se jim ne more pridružiti vsak (npr. ŽPS). Čas in kraj srečanj ostaneta prikazana.",
      },
      { kind: "string", name: "meetingsTitle", label: "Naslov namesto »Pridružite se«", max: 40, when: { field: "hideJoin", is: true }, help: "Ko je razdelek skrit, npr. »Seje«. Prazno: »Srečanja«." },
      {
        kind: "boolean",
        name: "prayerRequests",
        label: "Obrazec »Prošnja za molitev«",
        help: "Anonimen obrazec pod predstavitvijo. Prošnje se ne shranijo, ampak gredo po e-pošti na spodnji naslov.",
      },
      { kind: "text", name: "prayerIntro", label: "Besedilo nad obrazcem", rows: 2, max: 400, when: { field: "prayerRequests", is: true } },
      {
        kind: "string",
        name: "prayerEmail",
        label: "Prošnje prejme",
        when: { field: "prayerRequests", is: true },
        format: "email",
        patternMessage: EMAIL_MSG,
        help: `E-pošta župnika (ne skupni naslov župnije). Prazno: ${PRAYER_EMAIL_DEFAULT}.`,
      },
      { kind: "reference", name: "contactPerson", label: "Kontaktna oseba", to: ["person"] },
      { kind: "string", name: "contactName", label: "Kontakt (ime)", help: "Če kontaktna oseba ni med osebami." },
      { kind: "string", name: "email", label: "E-pošta", format: "email", patternMessage: EMAIL_MSG },
      { kind: "string", name: "phone", label: "Telefon" },
      { kind: "array", name: "links", label: "Povezave", of: [LINK_ITEM] },
      { kind: "image", name: "image", label: "Slika" },
      { kind: "images", name: "gallery", label: "Galerija" },
      { kind: "number", name: "order", label: "Vrstni red", initial: 10 },
      seo(),
    ],
    publicPath: (d) => str(d.href) || pathFor("parishGroup")(d),
  },

  // /zakramenti (ZUP-11, ZUP-12): the intro, then an optional image and two texts per tab (lib/sacraments/tabs.ts).
  sacramentsPage: {
    type: "sacramentsPage",
    label: "Zakramenti",
    plural: "Zakramenti",
    newLabel: "Zakramenti",
    area: "zupnija",
    singleton: true,
    titleField: "intro",
    fields: [
      { kind: "richText", name: "intro", label: "Uvod", variant: "full", help: "O bistvu zakramentov. Prikazano pod naslovom strani.", initial: placeholderText() },
      ...SACRAMENT_TABS.map(
        (t): Field => ({
          kind: "object",
          name: t.key,
          label: t.label,
          help: `Zavihek na naslovu /zakramenti#${t.key}.`,
          initial: { about: placeholderText(), arrange: placeholderText() },
          fields: [
            { kind: "image", name: "image", label: "Slika", help: "Neobvezno. Brez slike je zavihek samo besedilo." },
            { kind: "richText", name: "about", label: t.about, variant: "full" },
            {
              kind: "richText",
              name: "arrange",
              label: ARRANGE_HEADING,
              variant: "full",
              help: "V celih stavkih: kdaj in kje se oglasiti, kaj prinesti, elektronski naslov župnije.",
            },
          ],
        }),
      ),
    ],
    publicPath: () => "/zakramenti",
  },

  // /molitev and the homepage's "Pridite pred Najsvetejše" band (PRD US-012).
  prayerPage: {
    type: "prayerPage",
    label: "Molitev in češčenje",
    plural: "Molitev",
    newLabel: "Molitev",
    area: "zupnija",
    singleton: true,
    titleField: "title",
    fields: [
      { kind: "string", name: "title", label: "Naslov strani", required: true, initial: "Molitev in češčenje" },
      { kind: "richText", name: "intro", label: "Uvod", variant: "simple" },
      { kind: "image", name: "image", label: "Slika", help: "Prikazana na domači strani za pasom »Pridite pred Najsvetejše«." },
      {
        kind: "array",
        name: "items",
        label: "Molitvene ure",
        help: "Npr. »Češčenje Najsvetejšega · prvi petek v mesecu, 15.00–18.30 · Marijina cerkev«. Brez vnosov stran ni prikazana.",
        of: [
          {
            type: "prayerItem",
            label: "Molitvena ura",
            fields: [
              { kind: "string", name: "title", label: "Kaj", required: true, max: 120 },
              { kind: "string", name: "when", label: "Kdaj", required: true, max: 120 },
              { kind: "string", name: "place", label: "Kje", max: 120 },
              { kind: "text", name: "note", label: "Opomba", rows: 2, max: 300 },
              { kind: "boolean", name: "onHome", label: "Prikaži na domači strani" },
            ],
          },
        ],
      },
    ],
    publicPath: () => "/molitev",
  },

  // A purpose with its own UPN QR on /daruj, e.g. »Oratorij 2027 · 40 €« (PRD US-009).
  donationPurpose: {
    type: "donationPurpose",
    label: "Namen darovanja",
    plural: "Nameni darovanja",
    newLabel: "Nov namen",
    area: "zupnija",
    orderable: true,
    titleField: "title",
    subtitle: (d) => [d.amount ? `${d.amount} €` : "", d.until ? `do ${formatDate(String(d.until))}` : ""].filter(Boolean).join(" · "),
    fields: [
      { kind: "string", name: "title", label: "Naslov", required: true, max: 80, help: "Npr. »Oratorij 2027«." },
      { kind: "text", name: "description", label: "Opis", rows: 2, max: 300 },
      { kind: "number", name: "amount", label: "Znesek (€)", help: "Prazno: znesek vpiše darovalec." },
      { kind: "string", name: "purpose", label: "Namen plačila na UPN", required: true, max: 42, help: "Do 42 znakov, npr. »Oratorij 2027 – prispevek«." },
      { kind: "string", name: "reference", label: "Referenca", max: 26, help: "Npr. »SI00 2027«. Prazno: uporabi se referenca iz Nastavitev." },
      { kind: "date", name: "until", label: "Prikaži do", help: "Po tem dnevu namen ni več prikazan." },
    ],
    publicPath: () => "/daruj",
  },

  // Only the note and validity live here; the Mass times are edited under Maše in nameni.
  massSchedule: {
    type: "massSchedule",
    label: "Urnik maš",
    plural: "Urnik maš (opomba)",
    newLabel: "Nov urnik",
    area: "zupnija",
    titleField: "title",
    subtitle: (d) => (d.validFrom ? `od ${formatDate(String(d.validFrom))}` : "Redni urnik"),
    fields: [
      { kind: "string", name: "title", label: "Naslov", required: true, initial: "Redni urnik" },
      {
        kind: "richText",
        name: "note",
        label: "Opomba pod urnikom",
        variant: "simple",
        help: "Prikazana pod urnikom maš, npr. kako se dogovoriti za krst ali spoved. Ure maš urejate v razdelku Maše in nameni.",
      },
      { kind: "date", name: "validFrom", label: "Velja od", help: "Prazno pomeni redni urnik." },
      { kind: "date", name: "validUntil", label: "Velja do", after: "validFrom" },
      { kind: "boolean", name: "replacesRegular", label: "Nadomešča redni urnik" },
    ],
    publicPath: () => "/svete-mase",
  },
};

/** The placeholder the priest replaces with his text (ZUP-21): one paragraph, "vsebina". */
export function placeholderText(): Doc[] {
  return [{ _type: "block", _key: "vsebina", style: "normal", markDefs: [], children: [{ _type: "span", _key: "vsebina0", text: "vsebina", marks: [] }] }];
}

/** A document's title for lists and labels ("Brez naslova" when empty). */
export function titleOf(def: TypeDef, doc: Doc): string {
  if (def.singleton) return def.label;
  return str(doc[def.titleField]).trim() || "Brez naslova";
}

/** Initial values for a new document of this type (fields with `initial`). */
export function initialDoc(def: TypeDef, now: Date = new Date()): Doc {
  return { _type: def.type, ...initialValues(def.fields, now) };
}

export function initialValues(fields: Field[], now: Date = new Date()): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.initial === undefined) continue;
    out[f.name] = f.initial === "@now" ? now.toISOString() : f.initial === "@today" ? now.toISOString().slice(0, 10) : f.initial;
  }
  return out;
}

/** Whether a field is visible given its parent object's values (`when`). */
export function isShown(f: Field, parent: Record<string, unknown> | undefined): boolean {
  return !f.when || parent?.[f.when.field] === f.when.is;
}

/** Sanity-style slug from a title: lower-case ASCII, dashes, at most `max` chars. */
export function slugify(input: string, max = 96): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}
