import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons/Document'
import {DOCUMENT_CATEGORIES, formatSlDate} from '../../lib/constants'

/** A downloadable parish document (form, rules, newsletter …). */
export const parishDocument = defineType({
  name: 'parishDocument',
  title: 'Dokument',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov',
      type: 'string',
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: 'file',
      title: 'Datoteka',
      type: 'file',
      options: {accept: '.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Vrsta',
      type: 'string',
      options: {list: [...DOCUMENT_CATEGORIES]},
      initialValue: 'other',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Datum',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      initialValue: () => new Date().toISOString().slice(0, 10),
    }),
    defineField({
      name: 'description',
      title: 'Opis',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: 'public',
      title: 'Prikazano na spletni strani',
      type: 'boolean',
      initialValue: true,
      description: 'Izklopite, če želite dokument hraniti, a ga ne prikazati v seznamu dokumentov.',
    }),
  ],
  orderings: [{title: 'Najnovejši', name: 'newest', by: [{field: 'date', direction: 'desc'}]}],
  preview: {
    select: {title: 'title', category: 'category', date: 'date', ext: 'file.asset.extension'},
    prepare({title, category, date, ext}) {
      const cat = DOCUMENT_CATEGORIES.find((c) => c.value === category)?.title
      return {
        title,
        subtitle: [cat, formatSlDate(date), ext ? String(ext).toUpperCase() : null].filter(Boolean).join(' · '),
      }
    },
  },
})
