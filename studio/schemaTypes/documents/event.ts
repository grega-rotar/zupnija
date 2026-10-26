import {defineArrayMember, defineField, defineType} from 'sanity'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {EVENT_CATEGORIES, formatSlDateTime} from '../../lib/constants'

export const event = defineType({
  name: 'event',
  title: 'Dogodek',
  type: 'document',
  icon: CalendarIcon,
  groups: [
    {name: 'basic', title: 'Osnovno', default: true},
    {name: 'details', title: 'Podrobnosti'},
    {name: 'seo', title: 'Iskalniki'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov',
      type: 'string',
      group: 'basic',
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      group: 'basic',
      options: {source: 'title', maxLength: 80},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'start',
      title: 'Začetek',
      type: 'datetime',
      group: 'basic',
      options: {timeStep: 15},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'end',
      title: 'Konec',
      type: 'datetime',
      group: 'basic',
      description: 'Neobvezno.',
      options: {timeStep: 15},
      validation: (rule) =>
        rule.custom((value, context) => {
          const start = (context.document as {start?: string} | undefined)?.start
          if (start && value && value < start) return 'Konec mora biti po začetku.'
          return true
        }),
    }),
    defineField({
      name: 'allDay',
      title: 'Celodnevni dogodek',
      type: 'boolean',
      group: 'basic',
      initialValue: false,
      description: 'Ura se ne prikaže (npr. romanje, dan odprtih vrat).',
    }),
    defineField({
      name: 'church',
      title: 'Cerkev',
      type: 'reference',
      to: [{type: 'church'}],
      group: 'basic',
      description: 'Izberite, če dogodek poteka v eni od naših cerkva.',
    }),
    defineField({
      name: 'locationName',
      title: 'Kraj (če ni v cerkvi)',
      type: 'string',
      group: 'basic',
      description: 'Npr. »Župnijska dvorana« ali »Brezje«.',
    }),
    defineField({
      name: 'category',
      title: 'Vrsta dogodka',
      type: 'string',
      group: 'basic',
      options: {list: [...EVENT_CATEGORIES]},
      initialValue: 'other',
    }),
    defineField({
      name: 'summary',
      title: 'Povzetek',
      type: 'text',
      rows: 2,
      group: 'basic',
      description: 'Ena ali dve povedi za sezname in domačo stran.',
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: 'image',
      title: 'Slika',
      type: 'imageWithAlt',
      group: 'basic',
    }),
    defineField({
      name: 'description',
      title: 'Opis',
      type: 'blockContent',
      group: 'details',
    }),
    defineField({
      name: 'organizer',
      title: 'Organizator (skupina)',
      type: 'reference',
      to: [{type: 'parishGroup'}],
      group: 'details',
    }),
    defineField({
      name: 'organizerName',
      title: 'Organizator (besedilo)',
      type: 'string',
      group: 'details',
      description: 'Če organizator ni župnijska skupina.',
    }),
    defineField({
      name: 'registration',
      title: 'Prijava',
      type: 'link',
      group: 'details',
      description: 'Neobvezno. Povezava do prijavnice ali obrazca.',
    }),
    defineField({
      name: 'attachments',
      title: 'Priponke',
      type: 'array',
      group: 'details',
      of: [defineArrayMember({type: 'attachment'})],
    }),
    defineField({
      name: 'featured',
      title: 'Poudarjen dogodek',
      type: 'boolean',
      group: 'details',
      initialValue: false,
      description: 'Prikazan na domači strani pred drugimi dogodki.',
    }),
    defineField({name: 'seo', title: 'Iskalniki in deljenje', type: 'seo', group: 'seo'}),
  ],
  orderings: [
    {title: 'Po datumu (prihodnji)', name: 'startAsc', by: [{field: 'start', direction: 'asc'}]},
    {title: 'Po datumu (najnovejši)', name: 'startDesc', by: [{field: 'start', direction: 'desc'}]},
  ],
  preview: {
    select: {title: 'title', start: 'start', church: 'church.shortName', location: 'locationName', media: 'image'},
    prepare({title, start, church, location, media}) {
      return {
        title,
        subtitle: [formatSlDateTime(start), church || location].filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
