import {defineField, defineType} from 'sanity'
import {LinkIcon} from '@sanity/icons/Link'

/**
 * A link that can point either to a page on this website or to an external
 * address. Editors pick the kind; the other field is hidden.
 */
export const link = defineType({
  name: 'link',
  title: 'Povezava',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'label',
      title: 'Besedilo povezave',
      type: 'string',
      validation: (rule) => rule.required().max(60),
    }),
    defineField({
      name: 'kind',
      title: 'Vrsta povezave',
      type: 'string',
      options: {
        list: [
          {title: 'Stran na tej spletni strani', value: 'internal'},
          {title: 'Zunanja spletna povezava', value: 'external'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'internal',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'internal',
      title: 'Stran',
      type: 'reference',
      to: [
        {type: 'page'},
        {type: 'event'},
        {type: 'article'},
        {type: 'church'},
        {type: 'sacrament'},
        {type: 'parishGroup'},
        {type: 'gallery'},
        {type: 'announcement'},
      ],
      hidden: ({parent}) => parent?.kind !== 'internal',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as {kind?: string} | undefined
          if (parent?.kind === 'internal' && !value?._ref) return 'Izberite stran.'
          return true
        }),
    }),
    defineField({
      name: 'href',
      title: 'Spletni naslov',
      type: 'url',
      description: 'Vključno s https://',
      hidden: ({parent}) => parent?.kind !== 'external',
      validation: (rule) =>
        rule.uri({scheme: ['http', 'https', 'mailto', 'tel']}).custom((value, context) => {
          const parent = context.parent as {kind?: string} | undefined
          if (parent?.kind === 'external' && !value) return 'Vnesite spletni naslov.'
          return true
        }),
    }),
  ],
  preview: {
    select: {
      title: 'label',
      kind: 'kind',
      href: 'href',
      internalTitle: 'internal.title',
      internalName: 'internal.name',
    },
    prepare({title, kind, href, internalTitle, internalName}) {
      return {
        title: title || 'Povezava',
        subtitle: kind === 'external' ? href : internalTitle || internalName || 'Notranja stran',
      }
    },
  },
})
