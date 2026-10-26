import {defineField, defineType} from 'sanity'
import {ClockIcon} from '@sanity/icons/Clock'
import {WEEKDAYS, WEEKDAY_LABEL} from '../../lib/constants'

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/

/** One line of office hours, e.g. "Torek 16:00–18:00". */
export const openingHours = defineType({
  name: 'openingHours',
  title: 'Uradne ure',
  type: 'object',
  icon: ClockIcon,
  fields: [
    defineField({
      name: 'weekday',
      title: 'Dan',
      type: 'string',
      options: {list: [...WEEKDAYS]},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'from',
      title: 'Od',
      type: 'string',
      description: 'Ura v obliki 16:00',
      validation: (rule) =>
        rule.required().regex(TIME_PATTERN).error('Vnesite uro v obliki 16:00'),
    }),
    defineField({
      name: 'to',
      title: 'Do',
      type: 'string',
      description: 'Ura v obliki 18:00',
      validation: (rule) =>
        rule.required().regex(TIME_PATTERN).error('Vnesite uro v obliki 18:00'),
    }),
    defineField({
      name: 'note',
      title: 'Opomba',
      type: 'string',
      description: 'Neobvezno, npr. »po sveti maši« ali »samo po dogovoru«.',
    }),
  ],
  preview: {
    select: {weekday: 'weekday', from: 'from', to: 'to', note: 'note'},
    prepare({weekday, from, to, note}) {
      return {
        title: `${WEEKDAY_LABEL[weekday] ?? weekday ?? ''} ${from ?? ''}–${to ?? ''}`.trim(),
        subtitle: note,
      }
    },
  },
})
