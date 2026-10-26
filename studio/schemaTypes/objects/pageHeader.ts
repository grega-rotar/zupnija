import {defineField, defineType} from 'sanity'
import {ImageIcon} from '@sanity/icons/Image'

/** Photograph, short line and quotation at the top of a main page. */
export const pageHeader = defineType({
  name: 'pageHeader',
  title: 'Glava strani',
  type: 'object',
  icon: ImageIcon,
  options: {collapsible: true, collapsed: true},
  fields: [
    defineField({
      name: 'image',
      title: 'Fotografija',
      type: 'imageWithAlt',
      description: 'Vodoravna fotografija za ozadje naslova. Brez nje ima stran svetlo glavo.',
    }),
    defineField({
      name: 'tagline',
      title: 'Kratka vrstica pod naslovom',
      type: 'string',
      description: 'Npr. »Skupaj pred Gospodom.«',
      validation: (rule) => rule.max(80),
    }),
    defineField({
      name: 'quote',
      title: 'Misel',
      type: 'object',
      fields: [
        defineField({name: 'text', title: 'Besedilo', type: 'text', rows: 2, validation: (rule) => rule.max(200)}),
        defineField({name: 'source', title: 'Vir', type: 'string', validation: (rule) => rule.max(40)}),
      ],
    }),
  ],
})
