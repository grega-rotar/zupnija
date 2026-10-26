import {defineField, defineType} from 'sanity'
import {ImageIcon} from '@sanity/icons/Image'

export const imageWithAlt = defineType({
  name: 'imageWithAlt',
  title: 'Slika',
  type: 'image',
  icon: ImageIcon,
  options: {hotspot: true},
  fields: [
    defineField({
      name: 'alt',
      title: 'Opis slike',
      type: 'string',
      description:
        'Kratek opis, kaj je na sliki (npr. »Cerkev sv. Križa v Pirničah«). Pomaga slepim in slabovidnim ter iskalnikom.',
      validation: (rule) => rule.max(160).warning('Opis naj bo kratek.'),
    }),
    defineField({
      name: 'caption',
      title: 'Podnapis',
      type: 'string',
      description: 'Neobvezno. Prikaže se pod sliko.',
    }),
  ],
  preview: {
    select: {media: 'asset', title: 'caption', subtitle: 'alt'},
    prepare({media, title, subtitle}) {
      return {media, title: title || subtitle || 'Slika', subtitle: title ? subtitle : undefined}
    },
  },
})
