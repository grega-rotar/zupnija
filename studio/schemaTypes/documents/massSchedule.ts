import {defineArrayMember, defineField, defineType} from 'sanity'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {formatSlDate} from '../../lib/constants'

/**
 * A recurring weekly schedule. Usually there is one »Redni urnik« without
 * dates. Seasonal schedules (e.g. summer, Christmas week) get a date range
 * and override the regular one while they are valid.
 */
export const massSchedule = defineType({
  name: 'massSchedule',
  title: 'Urnik svetih maš',
  type: 'document',
  icon: CalendarIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Ime urnika',
      type: 'string',
      description: 'Npr. »Redni urnik«, »Poletni urnik« ali »Božični teden«.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'validFrom',
      title: 'Velja od',
      type: 'date',
      description: 'Pustite prazno pri rednem urniku, ki velja vse leto.',
      options: {dateFormat: 'D. M. YYYY'},
    }),
    defineField({
      name: 'validUntil',
      title: 'Velja do (vključno)',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      validation: (rule) =>
        rule.custom((value, context) => {
          const from = (context.document as {validFrom?: string} | undefined)?.validFrom
          if (from && value && value < from) return 'Datum »do« mora biti po datumu »od«.'
          return true
        }),
    }),
    defineField({
      name: 'replacesRegular',
      title: 'V tem obdobju velja samo ta urnik',
      type: 'boolean',
      description:
        'Vklopljeno: redni urnik v tem obdobju ne velja. Izklopljeno: te maše so dodane k rednemu urniku.',
      initialValue: true,
      hidden: ({document}) => !document?.validFrom && !document?.validUntil,
    }),
    defineField({
      name: 'entries',
      title: 'Svete maše',
      type: 'array',
      of: [defineArrayMember({type: 'massScheduleEntry'})],
      validation: (rule) => rule.required().min(1).error('Dodajte vsaj eno sveto mašo.'),
    }),
    defineField({
      name: 'note',
      title: 'Opomba k urniku',
      type: 'simpleBlockContent',
      description: 'Prikazano pod urnikom na spletni strani, npr. »Spoved pol ure pred vsako mašo.«',
    }),
  ],
  preview: {
    select: {title: 'title', from: 'validFrom', until: 'validUntil', entries: 'entries'},
    prepare({title, from, until, entries}) {
      const n = Array.isArray(entries) ? entries.length : 0
      const range =
        from || until ? `${formatSlDate(from) || '…'} – ${formatSlDate(until) || '…'}` : 'velja stalno'
      return {title, subtitle: `${range} · ${n} vnosov`}
    },
  },
})
