import {defineArrayMember, defineField, defineType} from 'sanity'
import {ImagesIcon} from '@sanity/icons/Images'
import {formatSlDate} from '../../lib/constants'

export const gallery = defineType({
  name: 'gallery',
  title: 'Galerija',
  type: 'document',
  icon: ImagesIcon,
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
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Datum',
      type: 'date',
      options: {dateFormat: 'D. M. YYYY'},
      initialValue: () => new Date().toISOString().slice(0, 10),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Opis',
      type: 'simpleBlockContent',
    }),
    defineField({
      name: 'images',
      title: 'Fotografije',
      type: 'array',
      description:
        'Povlecite več fotografij hkrati v to polje. Vrstni red lahko spremenite z vlečenjem. Prva fotografija je naslovna, če ni izbrana druga.',
      of: [defineArrayMember({type: 'imageWithAlt'})],
      options: {layout: 'grid'},
      validation: (rule) => rule.required().min(1).error('Dodajte vsaj eno fotografijo.'),
    }),
    defineField({
      name: 'cover',
      title: 'Naslovna fotografija',
      type: 'imageWithAlt',
      description: 'Neobvezno. Če je prazno, se uporabi prva fotografija.',
    }),
    defineField({
      name: 'relatedEvent',
      title: 'Povezan dogodek',
      type: 'reference',
      to: [{type: 'event'}],
    }),
    defineField({
      name: 'photographer',
      title: 'Avtor fotografij',
      type: 'string',
    }),
  ],
  orderings: [{title: 'Najnovejše', name: 'newest', by: [{field: 'date', direction: 'desc'}]}],
  preview: {
    select: {title: 'title', date: 'date', images: 'images', cover: 'cover', first: 'images.0'},
    prepare({title, date, images, cover, first}) {
      const n = Array.isArray(images) ? images.length : 0
      return {title, subtitle: `${formatSlDate(date)} · ${n} fotografij`, media: cover?.asset ? cover : first}
    },
  },
})
