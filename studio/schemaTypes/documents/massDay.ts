import {defineArrayMember, defineField, defineType} from 'sanity'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {formatSlDate, weekdayNameSl} from '../../lib/constants'

/**
 * One calendar day with its Masses and intentions — the way a parish actually
 * publishes »mašni nameni«. Masses matching the recurring schedule (same time
 * and church) enrich that Mass; others are added. The day can also replace
 * the recurring schedule entirely (feasts, funerals, changed times).
 */
export const massDay = defineType({
  name: 'massDay',
  title: 'Mašni dan',
  type: 'document',
  icon: CalendarIcon,
  fields: [
    defineField({
      name: 'date',
      title: 'Datum',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      validation: (rule) =>
        rule.required().custom(async (value, context) => {
          if (!value) return true
          const client = context.getClient({apiVersion: '2026-09-14'})
          const id = context.document?._id?.replace(/^drafts\./, '')
          const count = await client.fetch<number>(
            `count(*[_type == "massDay" && date == $date && !(_id in [$id, "drafts." + $id])])`,
            {date: value, id},
          )
          return count === 0 || 'Za ta datum mašni dan že obstaja. Uredite obstoječega.'
        }),
    }),
    defineField({
      name: 'liturgicalTitle',
      title: 'Liturgični dan / praznik',
      type: 'string',
      description: 'Npr. »24. nedelja med letom« ali »Povišanje sv. Križa — žegnanje«.',
    }),
    defineField({
      name: 'masses',
      title: 'Svete maše',
      type: 'array',
      of: [defineArrayMember({type: 'massOccurrence'})],
      description:
        'Vpišite maše z nameni. Če se ura in cerkev ujemata z rednim urnikom, se namen doda k redni maši.',
    }),
    defineField({
      name: 'replacesSchedule',
      title: 'Ta dan veljajo samo zgoraj vpisane maše',
      type: 'boolean',
      description:
        'Vklopite, kadar redni urnik ta dan ne velja (npr. praznik, romanje, sprememba). Izklopljeno: redne maše ostanejo, zgornje jih dopolnijo.',
      initialValue: false,
    }),
    defineField({
      name: 'note',
      title: 'Opomba za ta dan',
      type: 'simpleBlockContent',
      description: 'Npr. »Po maši ofer za obnovo strehe.«',
    }),
  ],
  orderings: [
    {title: 'Datum (najnovejši)', name: 'dateDesc', by: [{field: 'date', direction: 'desc'}]},
    {title: 'Datum (najstarejši)', name: 'dateAsc', by: [{field: 'date', direction: 'asc'}]},
  ],
  preview: {
    select: {date: 'date', liturgicalTitle: 'liturgicalTitle', masses: 'masses', replaces: 'replacesSchedule'},
    prepare({date, liturgicalTitle, masses, replaces}) {
      const n = Array.isArray(masses) ? masses.length : 0
      return {
        title: `${weekdayNameSl(date)}, ${formatSlDate(date)}`,
        subtitle: [liturgicalTitle, `${n} maš`, replaces ? 'nadomešča urnik' : null]
          .filter(Boolean)
          .join(' · '),
      }
    },
  },
})
