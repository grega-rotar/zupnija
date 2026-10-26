import {defineArrayMember, defineField, defineType} from 'sanity'
import {SparklesIcon} from '@sanity/icons/Sparkles'
import {LITURGICAL_SEASONS, formatSlDate} from '../../lib/constants'

/**
 * A temporary period with its own message, optional Mass schedule and
 * highlighted content: Advent, Christmas, Lent, Holy Week, Easter, parish
 * feast, First Communion … The website features it while it is active.
 */
export const specialPeriod = defineType({
  name: 'specialPeriod',
  title: 'Posebno obdobje',
  type: 'document',
  icon: SparklesIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov',
      type: 'string',
      description: 'Npr. »Božič 2026«, »Postni čas«, »Farno žegnanje«.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      options: {source: 'title', maxLength: 80},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'activeFrom',
      title: 'Prikazano od',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'activeUntil',
      title: 'Prikazano do (vključno)',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      validation: (rule) =>
        rule.required().custom((value, context) => {
          const from = (context.document as {activeFrom?: string} | undefined)?.activeFrom
          if (from && value && value < from) return 'Datum »do« mora biti po datumu »od«.'
          return true
        }),
    }),
    defineField({
      name: 'season',
      title: 'Liturgični poudarek',
      type: 'string',
      options: {list: [...LITURGICAL_SEASONS]},
      initialValue: 'none',
      description: 'Doda nežen barvni poudarek. Spletna stran ostane berljiva in umirjena.',
    }),
    defineField({
      name: 'image',
      title: 'Slika',
      type: 'imageWithAlt',
    }),
    defineField({
      name: 'message',
      title: 'Sporočilo',
      type: 'blockContent',
      description: 'Voščilo, vabilo, program obredov …',
    }),
    defineField({
      name: 'schedule',
      title: 'Poseben urnik svetih maš',
      type: 'reference',
      to: [{type: 'massSchedule'}],
      description:
        'Neobvezno. Urnik se prikaže na strani obdobja. Za dejanske spremembe maš na posamezne dneve uporabite »Mašne dneve«.',
    }),
    defineField({
      name: 'officeHoursNote',
      title: 'Spremenjene uradne ure',
      type: 'string',
      description: 'Npr. »Med prazniki uradnih ur ni.« Prikazano pri kontaktu, dokler je obdobje aktivno.',
    }),
    defineField({
      name: 'events',
      title: 'Povezani dogodki',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'event'}]})],
    }),
    defineField({
      name: 'announcements',
      title: 'Povezana oznanila',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'announcement'}]})],
    }),
    defineField({
      name: 'attachments',
      title: 'Priponke',
      type: 'array',
      of: [defineArrayMember({type: 'attachment'})],
    }),
  ],
  orderings: [{title: 'Od datuma', name: 'from', by: [{field: 'activeFrom', direction: 'desc'}]}],
  preview: {
    select: {title: 'title', from: 'activeFrom', until: 'activeUntil', media: 'image'},
    prepare({title, from, until, media}) {
      return {title, subtitle: `${formatSlDate(from)} – ${formatSlDate(until)}`, media}
    },
  },
})
