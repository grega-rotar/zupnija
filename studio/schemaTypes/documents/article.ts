import {defineArrayMember, defineField, defineType} from 'sanity'
import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {formatSlDate} from '../../lib/constants'

export const article = defineType({
  name: 'article',
  title: 'Novica',
  type: 'document',
  icon: DocumentTextIcon,
  groups: [
    {name: 'content', title: 'Vsebina', default: true},
    {name: 'meta', title: 'Podrobnosti'},
    {name: 'seo', title: 'Iskalniki'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(140),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Povzetek',
      type: 'text',
      rows: 3,
      group: 'content',
      description: 'Dve ali tri povedi. Prikazano v seznamih in pri deljenju.',
      validation: (rule) => rule.required().max(300),
    }),
    defineField({
      name: 'image',
      title: 'Glavna slika',
      type: 'imageWithAlt',
      group: 'content',
    }),
    defineField({
      name: 'body',
      title: 'Besedilo',
      type: 'blockContent',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'gallery',
      title: 'Galerija',
      type: 'reference',
      to: [{type: 'gallery'}],
      group: 'content',
      description: 'Neobvezno. Povezana galerija se prikaže pod novico.',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Datum objave',
      type: 'datetime',
      group: 'meta',
      initialValue: () => new Date().toISOString(),
      options: {timeStep: 15},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Avtor',
      type: 'reference',
      to: [{type: 'person'}],
      group: 'meta',
      description: 'Neobvezno.',
    }),
    defineField({
      name: 'relatedEvent',
      title: 'Povezan dogodek',
      type: 'reference',
      to: [{type: 'event'}],
      group: 'meta',
    }),
    defineField({
      name: 'attachments',
      title: 'Priponke',
      type: 'array',
      group: 'meta',
      of: [defineArrayMember({type: 'attachment'})],
    }),
    defineField({name: 'seo', title: 'Iskalniki in deljenje', type: 'seo', group: 'seo'}),
  ],
  orderings: [{title: 'Najnovejše', name: 'newest', by: [{field: 'publishedAt', direction: 'desc'}]}],
  preview: {
    select: {title: 'title', date: 'publishedAt', media: 'image'},
    prepare({title, date, media}) {
      return {title, subtitle: formatSlDate(date?.slice(0, 10)), media}
    },
  },
})
