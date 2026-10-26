/**
 * Shared constants for the parish Studio.
 * Labels are Slovenian because parish staff use the Studio; values stay
 * stable English identifiers so the website can rely on them.
 */

export const WEEKDAYS = [
  {title: 'Ponedeljek', value: 'monday'},
  {title: 'Torek', value: 'tuesday'},
  {title: 'Sreda', value: 'wednesday'},
  {title: 'Četrtek', value: 'thursday'},
  {title: 'Petek', value: 'friday'},
  {title: 'Sobota', value: 'saturday'},
  {title: 'Nedelja', value: 'sunday'},
] as const

export const WEEKDAY_LABEL: Record<string, string> = Object.fromEntries(
  WEEKDAYS.map((d) => [d.value, d.title]),
)

export const MASS_TYPES = [
  {title: 'Sveta maša', value: 'regular'},
  {title: 'Nedeljska maša', value: 'sunday'},
  {title: 'Družinska maša', value: 'family'},
  {title: 'Otroška maša', value: 'children'},
  {title: 'Mladinska maša', value: 'youth'},
  {title: 'Večerna maša', value: 'evening'},
  {title: 'Praznična maša', value: 'feast'},
  {title: 'Pogrebna maša', value: 'funeral'},
  {title: 'Poročna maša', value: 'wedding'},
  {title: 'Božična polnočnica', value: 'midnight'},
  {title: 'Velikonočna vigilija', value: 'vigil'},
  {title: 'Drugo bogoslužje', value: 'other'},
] as const

export const MASS_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  MASS_TYPES.map((t) => [t.value, t.title]),
)

export const INTENTION_KINDS = [
  {title: '† Za pokojne', value: 'deceased'},
  {title: 'Za žive', value: 'living'},
  {title: 'Za zdravje', value: 'health'},
  {title: 'V zahvalo', value: 'thanksgiving'},
  {title: 'Po namenu', value: 'intention'},
  {title: 'Za župljane', value: 'parish'},
  {title: 'Drugo', value: 'other'},
] as const

export const ANNOUNCEMENT_IMPORTANCE = [
  {title: 'Običajno', value: 'normal'},
  {title: 'Pomembno', value: 'important'},
  {title: 'Nujno', value: 'urgent'},
] as const

export const ANNOUNCEMENT_CATEGORIES = [
  {title: 'Obvestilo', value: 'notice'},
  {title: 'Pastoralno obvestilo', value: 'pastoral'},
  {title: 'Posebni termini', value: 'special'},
  {title: 'Verouk', value: 'catechesis'},
  {title: 'Karitas', value: 'caritas'},
] as const

export const EVENT_CATEGORIES = [
  {title: 'Bogoslužje', value: 'liturgy'},
  {title: 'Praznik', value: 'feast'},
  {title: 'Romanje', value: 'pilgrimage'},
  {title: 'Verouk', value: 'catechesis'},
  {title: 'Mladi', value: 'youth'},
  {title: 'Družine', value: 'families'},
  {title: 'Karitas', value: 'caritas'},
  {title: 'Kultura', value: 'culture'},
  {title: 'Srečanje', value: 'meeting'},
  {title: 'Drugo', value: 'other'},
] as const

export const PERSON_ROLES = [
  {title: 'Župnik', value: 'pastor'},
  {title: 'Kaplan', value: 'assistant'},
  {title: 'Duhovni pomočnik', value: 'helper'},
  {title: 'Diakon', value: 'deacon'},
  {title: 'Katehet / katehistinja', value: 'catechist'},
  {title: 'Pastoralni sodelavec', value: 'pastoral'},
  {title: 'Tajništvo', value: 'office'},
  {title: 'Drugo', value: 'other'},
] as const

export const SACRAMENT_KINDS = [
  {title: 'Krst', value: 'baptism'},
  {title: 'Prvo sveto obhajilo', value: 'communion'},
  {title: 'Sveta birma', value: 'confirmation'},
  {title: 'Sveta poroka', value: 'marriage'},
  {title: 'Sveta spoved', value: 'confession'},
  {title: 'Bolniško maziljenje', value: 'anointing'},
  {title: 'Pogreb', value: 'funeral'},
] as const

export const CHURCH_KINDS = [
  {title: 'Župnijska cerkev', value: 'parish'},
  {title: 'Podružnična cerkev', value: 'filial'},
  {title: 'Kapela', value: 'chapel'},
] as const

export const DOCUMENT_CATEGORIES = [
  {title: 'Obrazci', value: 'forms'},
  {title: 'Verouk', value: 'catechesis'},
  {title: 'Oznanila', value: 'bulletins'},
  {title: 'Župnijski list', value: 'newsletter'},
  {title: 'Pravila in informacije', value: 'info'},
  {title: 'Drugo', value: 'other'},
] as const

export const LITURGICAL_SEASONS = [
  {title: 'Brez posebnega poudarka', value: 'none'},
  {title: 'Advent (vijolična)', value: 'advent'},
  {title: 'Božič (zlata)', value: 'christmas'},
  {title: 'Post (vijolična)', value: 'lent'},
  {title: 'Velika noč (bela)', value: 'easter'},
  {title: 'Binkošti (rdeča)', value: 'pentecost'},
  {title: 'Marijin praznik (modra)', value: 'marian'},
] as const

/** Format a Sanity date (YYYY-MM-DD) as Slovenian short date: 14. 9. 2026 */
export function formatSlDate(value?: string): string {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return value
  return `${d}. ${m}. ${y}`
}

/** Format an ISO datetime as Slovenian short date + time in Ljubljana time. */
export function formatSlDateTime(value?: string): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('sl-SI', {
      timeZone: 'Europe/Ljubljana',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

/** Slovenian weekday name for a YYYY-MM-DD date. */
export function weekdayNameSl(value?: string): string {
  if (!value) return ''
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  const name = new Intl.DateTimeFormat('sl-SI', {weekday: 'long', timeZone: 'UTC'}).format(date)
  return name.charAt(0).toUpperCase() + name.slice(1)
}
