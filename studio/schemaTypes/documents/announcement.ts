import {defineArrayMember, defineField, defineType} from 'sanity'
import {BellIcon} from '@sanity/icons/Bell'
import {ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_IMPORTANCE, formatSlDate} from '../../lib/constants'

export const announcement = defineType({
  name: 'announcement',
  title: 'Oznanilo',
  type: 'document',
  icon: BellIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov',
      type: 'string',
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      options: {source: 'title', maxLength: 80},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Vrsta',
      type: 'string',
      options: {list: [...ANNOUNCEMENT_CATEGORIES]},
      initialValue: 'notice',
    }),
    defineField({
      name: 'image',
      title: 'Slika',
      type: 'imageWithAlt',
      description: 'Neobvezno. Prikazana ob oznanilu v seznamu.',
    }),
    defineField({
      name: 'importance',
      title: 'Pomembnost',
      type: 'string',
      options: {list: [...ANNOUNCEMENT_IMPORTANCE], layout: 'radio', direction: 'horizontal'},
      initialValue: 'normal',
      description: '»Nujno« se prikaže v opozorilnem traku na vrhu strani. Uporabite redko.',
    }),
    defineField({
      name: 'summary',
      title: 'Povzetek',
      type: 'text',
      rows: 2,
      description: 'Ena ali dve povedi. Prikazano na domači strani in v seznamih.',
      validation: (rule) => rule.required().max(240),
    }),
    defineField({
      name: 'body',
      title: 'Besedilo',
      type: 'blockContent',
    }),
    defineField({
      name: 'publishFrom',
      title: 'Objavljeno od',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      options: {timeStep: 15},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'publishUntil',
      title: 'Objavljeno do',
      type: 'datetime',
      description:
        'Po tem datumu oznanilo izgine z domače strani in aktualnih seznamov, ostane pa v arhivu.',
      options: {timeStep: 15},
      validation: (rule) =>
        rule.custom((value, context) => {
          const from = (context.document as {publishFrom?: string} | undefined)?.publishFrom
          if (from && value && value < from) return 'Datum »do« mora biti po datumu »od«.'
          return true
        }),
    }),
    defineField({
      name: 'showOnHomepage',
      title: 'Prikaži na domači strani',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'cta',
      title: 'Gumb (neobvezno)',
      type: 'link',
      description: 'Npr. »Prijavnica« ali »Več o romanju«.',
    }),
    defineField({
      name: 'relatedEvent',
      title: 'Povezan dogodek',
      type: 'reference',
      to: [{type: 'event'}],
    }),
    defineField({
      name: 'attachments',
      title: 'Priponke',
      type: 'array',
      of: [defineArrayMember({type: 'attachment'})],
    }),
  ],
  orderings: [
    {title: 'Najnovejše', name: 'newest', by: [{field: 'publishFrom', direction: 'desc'}]},
  ],
  preview: {
    select: {title: 'title', importance: 'importance', from: 'publishFrom', until: 'publishUntil', media: 'image'},
    prepare({title, importance, from, until, media}) {
      const level = ANNOUNCEMENT_IMPORTANCE.find((i) => i.value === importance)?.title
      const expired = until && new Date(until) < new Date()
      return {
        title,
        media,
        subtitle: [
          expired ? 'poteklo' : level !== 'Običajno' ? level : null,
          formatSlDate(from?.slice(0, 10)),
        ]
          .filter(Boolean)
          .join(' · '),
      }
    },
  },
})
