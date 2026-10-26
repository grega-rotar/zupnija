import {defineArrayMember, defineField, defineType} from 'sanity'
import {HomeIcon} from '@sanity/icons/Home'

/**
 * Singleton: the few things on the homepage that are editorial rather than
 * derived from parish data (Masses, announcements, events come automatically).
 */
export const homePage = defineType({
  name: 'homePage',
  title: 'Domača stran',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'heroImage',
      title: 'Glavna fotografija',
      type: 'imageWithAlt',
      description: 'Velika fotografija na vrhu domače strani. Najbolje vodoravna, cerkev ali kraj.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heroEyebrow',
      title: 'Kratka vrstica nad naslovom',
      type: 'string',
      description: 'Neobvezno, npr. »Skupaj na poti vere«.',
      validation: (rule) => rule.max(40),
    }),
    defineField({
      name: 'heroTitle',
      title: 'Naslov',
      type: 'string',
      description: 'Če je prazno, se uporabi ime župnije.',
      validation: (rule) => rule.max(60),
    }),
    defineField({
      name: 'heroText',
      title: 'Uvodno besedilo',
      type: 'text',
      rows: 3,
      description: 'Ena ali dve mirni povedi dobrodošlice. Brez oglaševalskega tona.',
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: 'heroQuote',
      title: 'Svetopisemska misel v naslovni sliki',
      type: 'object',
      description: 'Neobvezno. Kratek navedek in vir, npr. Mt 18,20.',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({name: 'text', title: 'Besedilo', type: 'text', rows: 2, validation: (rule) => rule.max(200)}),
        defineField({name: 'source', title: 'Vir', type: 'string', validation: (rule) => rule.max(40)}),
      ],
    }),
    defineField({
      name: 'tile',
      title: 'Slika z mislijo na domači strani',
      type: 'object',
      description: 'Neobvezno. Slika s kratko mislijo poleg današnjih maš in tedenskih oznanil.',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({name: 'image', title: 'Slika', type: 'imageWithAlt'}),
        defineField({name: 'text', title: 'Misel', type: 'text', rows: 2, validation: (rule) => rule.max(160)}),
        defineField({name: 'source', title: 'Vir', type: 'string', validation: (rule) => rule.max(40)}),
      ],
    }),
    defineField({
      name: 'welcome',
      title: 'Nagovor',
      type: 'object',
      description: 'Neobvezen daljši nagovor župnika ali predstavitev župnije na domači strani.',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({name: 'title', title: 'Naslov', type: 'string'}),
        defineField({name: 'text', title: 'Besedilo', type: 'simpleBlockContent'}),
        defineField({name: 'image', title: 'Slika', type: 'imageWithAlt'}),
        defineField({name: 'link', title: 'Povezava', type: 'link'}),
      ],
    }),
    defineField({
      name: 'featuredLinks',
      title: 'Poudarjene povezave',
      type: 'array',
      description: 'Neobvezno. Do štiri povezave, ki so trenutno pomembne (npr. verouk, prijave, romanje).',
      of: [defineArrayMember({type: 'link'})],
      validation: (rule) => rule.max(4),
    }),
    defineField({
      name: 'seo',
      title: 'Iskalniki in deljenje',
      type: 'seo',
    }),
  ],
  preview: {
    prepare: () => ({title: 'Domača stran'}),
  },
})
