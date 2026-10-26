import {defineArrayMember, defineField, defineType} from 'sanity'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {ClockIcon} from '@sanity/icons/Clock'
import {HeartIcon} from '@sanity/icons/Heart'
import {INTENTION_KINDS, MASS_TYPES, MASS_TYPE_LABEL, WEEKDAYS, WEEKDAY_LABEL} from '../../lib/constants'

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/

const timeField = defineField({
  name: 'time',
  title: 'Ura',
  type: 'string',
  description: 'V obliki 08:00 ali 19:30',
  validation: (rule) => rule.required().regex(TIME_PATTERN).error('Vnesite uro v obliki 08:00'),
})

const churchField = defineField({
  name: 'church',
  title: 'Cerkev',
  type: 'reference',
  to: [{type: 'church'}],
  validation: (rule) => rule.required(),
})

const typeField = defineField({
  name: 'type',
  title: 'Vrsta',
  type: 'string',
  options: {list: [...MASS_TYPES]},
  initialValue: 'regular',
})

/**
 * One line in a recurring schedule, e.g. »Nedelja 08:00 · Sv. Križ«.
 * The website expands it into concrete dates.
 */
export const massScheduleEntry = defineType({
  name: 'massScheduleEntry',
  title: 'Redna sveta maša',
  type: 'object',
  icon: ClockIcon,
  fields: [
    defineField({
      name: 'weekdays',
      title: 'Dnevi v tednu',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {list: [...WEEKDAYS], layout: 'grid'},
      validation: (rule) => rule.required().min(1).error('Izberite vsaj en dan.'),
    }),
    timeField,
    churchField,
    typeField,
    defineField({
      name: 'note',
      title: 'Opomba',
      type: 'string',
      description: 'Neobvezno, npr. »s petjem otroškega zbora« ali »v zimskem času v kapeli«.',
    }),
  ],
  preview: {
    select: {weekdays: 'weekdays', time: 'time', church: 'church.shortName', type: 'type'},
    prepare({weekdays, time, church, type}) {
      const days = Array.isArray(weekdays)
        ? weekdays.map((d: string) => WEEKDAY_LABEL[d] ?? d).join(', ')
        : ''
      return {
        title: `${time ?? '--:--'} · ${church ?? 'cerkev?'}`,
        subtitle: [days, type && type !== 'regular' ? MASS_TYPE_LABEL[type] : null]
          .filter(Boolean)
          .join(' — '),
      }
    },
  },
})

/** A single Mass intention, e.g. »† Jože Novak, obl.« */
export const massIntention = defineType({
  name: 'massIntention',
  title: 'Mašni namen',
  type: 'object',
  icon: HeartIcon,
  fields: [
    defineField({
      name: 'kind',
      title: 'Vrsta namena',
      type: 'string',
      options: {list: [...INTENTION_KINDS]},
      initialValue: 'deceased',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'text',
      title: 'Namen',
      type: 'string',
      description:
        'Zapišite tako, kot ga oznanite, npr. »Jože Novak, obl.« ali »starši Kovač«. Križec (†) doda spletna stran sama.',
      validation: (rule) => rule.required().max(200),
    }),
  ],
  preview: {
    select: {kind: 'kind', text: 'text'},
    prepare({kind, text}) {
      return {title: `${kind === 'deceased' ? '† ' : ''}${text ?? ''}`}
    },
  },
})

/**
 * A concrete Mass on a concrete day (inside »Mašni dan«). If the time and
 * church match a recurring entry, it *enriches* that Mass (intentions, note,
 * cancellation). Otherwise it is an additional Mass.
 */
export const massOccurrence = defineType({
  name: 'massOccurrence',
  title: 'Sveta maša',
  type: 'object',
  icon: CalendarIcon,
  fields: [
    timeField,
    churchField,
    typeField,
    defineField({
      name: 'intentions',
      title: 'Mašni nameni',
      type: 'array',
      of: [defineArrayMember({type: 'massIntention'})],
    }),
    defineField({
      name: 'celebrant',
      title: 'Mašuje',
      type: 'reference',
      to: [{type: 'person'}],
      description: 'Neobvezno. Izpolnite le, če mašuje gost ali je pomembno.',
    }),
    defineField({
      name: 'note',
      title: 'Opomba',
      type: 'string',
      description: 'Neobvezno, npr. »po maši blagoslov otrok« ali »z ljudskim petjem«.',
    }),
    defineField({
      name: 'status',
      title: 'Stanje',
      type: 'string',
      options: {
        list: [
          {title: 'Bo (običajno)', value: 'scheduled'},
          {title: 'Odpade', value: 'cancelled'},
          {title: 'Spremenjeno (prestavljena ura/cerkev)', value: 'changed'},
        ],
        layout: 'radio',
      },
      initialValue: 'scheduled',
    }),
    defineField({
      name: 'statusNote',
      title: 'Pojasnilo',
      type: 'string',
      description: 'Kratko pojasnilo za obiskovalce, npr. »zaradi pogreba« ali »namesto ob 8.00«.',
      hidden: ({parent}) => !parent?.status || parent.status === 'scheduled',
    }),
  ],
  preview: {
    select: {
      time: 'time',
      church: 'church.shortName',
      type: 'type',
      status: 'status',
      first: 'intentions.0.text',
      firstKind: 'intentions.0.kind',
      second: 'intentions.1.text',
    },
    prepare({time, church, type, status, first, firstKind, second}) {
      const statusLabel = status === 'cancelled' ? 'ODPADE — ' : status === 'changed' ? 'SPREMEMBA — ' : ''
      const intention = first ? `${firstKind === 'deceased' ? '† ' : ''}${first}${second ? ' …' : ''}` : 'brez namena'
      return {
        title: `${statusLabel}${time ?? '--:--'} · ${church ?? 'cerkev?'}`,
        subtitle: [type && type !== 'regular' ? MASS_TYPE_LABEL[type] : null, intention]
          .filter(Boolean)
          .join(' — '),
      }
    },
  },
})
