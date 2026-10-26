import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons/Book'
import {formatSlDate} from '../../lib/constants'

/** Adds days to a YYYY-MM-DD string and returns YYYY-MM-DD. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * »Tedenska oznanila« — the weekly sheet read at Sunday Mass. The website
 * combines it with the Masses of that week (from »Mašni dnevi«) automatically.
 */
export const weeklyBulletin = defineType({
  name: 'weeklyBulletin',
  title: 'Tedenska oznanila',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({
      name: 'weekStart',
      title: 'Teden od (nedelja)',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'weekEnd',
      title: 'Teden do (sobota)',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      description: 'Če je prazno, se uporabi 6 dni po začetku tedna.',
      validation: (rule) =>
        rule.custom((value, context) => {
          const from = (context.document as {weekStart?: string} | undefined)?.weekStart
          if (from && value && value < from) return 'Datum »do« mora biti po datumu »od«.'
          return true
        }),
    }),
    defineField({
      name: 'liturgicalNotes',
      title: 'Liturgični koledar',
      type: 'simpleBlockContent',
      description: 'Nedelja, prazniki in godovi tega tedna.',
    }),
    defineField({
      name: 'items',
      title: 'Oznanila',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'bulletinItem',
          title: 'Oznanilo',
          fields: [
            defineField({
              name: 'title',
              title: 'Naslov',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({name: 'body', title: 'Besedilo', type: 'simpleBlockContent'}),
          ],
          preview: {select: {title: 'title'}},
        }),
      ],
    }),
    defineField({
      name: 'specialInfo',
      title: 'Posebna obvestila',
      type: 'blockContent',
      description: 'Npr. spremembe maš, čiščenje cerkve, zahvale.',
    }),
    defineField({
      name: 'events',
      title: 'Dogodki v tem tednu',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'event'}]})],
      description: 'Neobvezno. Dogodki tega tedna se prikažejo tudi samodejno po datumu.',
    }),
    defineField({
      name: 'attachments',
      title: 'Priponke',
      type: 'array',
      of: [defineArrayMember({type: 'attachment'})],
      description: 'Npr. natisnjena oznanila v PDF.',
    }),
  ],
  orderings: [{title: 'Najnovejši teden', name: 'newest', by: [{field: 'weekStart', direction: 'desc'}]}],
  preview: {
    select: {start: 'weekStart', end: 'weekEnd', items: 'items'},
    prepare({start, end, items}) {
      const n = Array.isArray(items) ? items.length : 0
      const endDate = end || (start ? addDays(start, 6) : undefined)
      return {
        title: start ? `${formatSlDate(start)} – ${formatSlDate(endDate)}` : 'Tedenska oznanila',
        subtitle: `${n} oznanil`,
      }
    },
  },
})
