import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons/Document'

/** A flexible informational page built from approved sections. */
export const page = defineType({
  name: 'page',
  title: 'Stran',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov strani',
      type: 'string',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      description: 'Del naslova za zadnjo poševnico, npr. »o-zupniji« → zupnija-pirnice.si/o-zupniji',
      options: {source: 'title', maxLength: 80},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'intro',
      title: 'Uvodno besedilo',
      type: 'text',
      rows: 3,
      description: 'Neobvezno. Prikazano pod naslovom.',
      validation: (rule) => rule.max(300),
    }),
    defineField({
      name: 'sections',
      title: 'Odseki',
      type: 'pageSections',
    }),
    defineField({name: 'seo', title: 'Iskalniki in deljenje', type: 'seo'}),
  ],
  preview: {
    select: {title: 'title', slug: 'slug.current'},
    prepare({title, slug}) {
      return {title, subtitle: slug ? `/${slug}` : undefined}
    },
  },
})
