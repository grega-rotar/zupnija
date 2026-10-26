import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons/Document'

/** A file attached inline (PDF, DOCX …). For shared parish documents use the »Dokument« type. */
export const attachment = defineType({
  name: 'attachment',
  title: 'Priponka',
  type: 'object',
  icon: DocumentIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'file',
      title: 'Datoteka',
      type: 'file',
      options: {accept: '.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.jpg,.jpeg,.png'},
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'title', ext: 'file.asset.extension'},
    prepare({title, ext}) {
      return {title: title || 'Priponka', subtitle: ext ? String(ext).toUpperCase() : undefined}
    },
  },
})
