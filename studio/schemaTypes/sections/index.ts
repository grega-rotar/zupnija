import {defineArrayMember, defineField, defineType} from 'sanity'
import {BlockContentIcon} from '@sanity/icons/BlockContent'
import {BlockquoteIcon} from '@sanity/icons/Blockquote'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {DocumentIcon} from '@sanity/icons/Document'
import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {HelpCircleIcon} from '@sanity/icons/HelpCircle'
import {HomeIcon} from '@sanity/icons/Home'
import {ImageIcon} from '@sanity/icons/Image'
import {ImagesIcon} from '@sanity/icons/Images'
import {LinkIcon} from '@sanity/icons/Link'
import {ClockIcon} from '@sanity/icons/Clock'
import {UsersIcon} from '@sanity/icons/Users'

/**
 * Approved page sections. Editors choose and reorder; the design system
 * decides how they look. No colours, fonts or spacing options on purpose.
 */

export const sectionHero = defineType({
  name: 'sectionHero',
  title: 'Naslovna slika',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({name: 'image', title: 'Slika', type: 'imageWithAlt', validation: (rule) => rule.required()}),
    defineField({name: 'title', title: 'Naslov', type: 'string'}),
    defineField({name: 'text', title: 'Besedilo', type: 'text', rows: 2, validation: (rule) => rule.max(240)}),
  ],
  preview: {
    select: {title: 'title', media: 'image'},
    prepare({title, media}) {
      return {title: title || 'Naslovna slika', subtitle: 'Naslovna slika', media}
    },
  },
})

export const sectionRichText = defineType({
  name: 'sectionRichText',
  title: 'Besedilo',
  type: 'object',
  icon: BlockContentIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string'}),
    defineField({name: 'body', title: 'Besedilo', type: 'blockContent', validation: (rule) => rule.required()}),
  ],
  preview: {
    select: {title: 'title', body: 'body'},
    prepare({title, body}) {
      const firstText = Array.isArray(body)
        ? body.find((b: {_type?: string}) => b._type === 'block')?.children?.map((c: {text?: string}) => c.text).join('')
        : undefined
      return {title: title || firstText || 'Besedilo', subtitle: 'Besedilo'}
    },
  },
})

export const sectionTextImage = defineType({
  name: 'sectionTextImage',
  title: 'Besedilo in slika',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string'}),
    defineField({name: 'body', title: 'Besedilo', type: 'simpleBlockContent', validation: (rule) => rule.required()}),
    defineField({name: 'image', title: 'Slika', type: 'imageWithAlt', validation: (rule) => rule.required()}),
    defineField({
      name: 'imageSide',
      title: 'Slika je',
      type: 'string',
      options: {
        list: [
          {title: 'Desno', value: 'right'},
          {title: 'Levo', value: 'left'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'right',
    }),
    defineField({name: 'link', title: 'Povezava', type: 'link'}),
  ],
  preview: {
    select: {title: 'title', media: 'image'},
    prepare({title, media}) {
      return {title: title || 'Besedilo in slika', subtitle: 'Besedilo in slika', media}
    },
  },
})

export const sectionQuote = defineType({
  name: 'sectionQuote',
  title: 'Citat',
  type: 'object',
  icon: BlockquoteIcon,
  fields: [
    defineField({name: 'quote', title: 'Besedilo', type: 'text', rows: 3, validation: (rule) => rule.required().max(400)}),
    defineField({name: 'source', title: 'Vir', type: 'string', description: 'Npr. »Mt 5,9« ali »papež Frančišek«.'}),
  ],
  preview: {
    select: {title: 'quote', subtitle: 'source'},
    prepare({title, subtitle}) {
      return {title: title || 'Citat', subtitle: subtitle ? `Citat · ${subtitle}` : 'Citat'}
    },
  },
})

export const sectionGallery = defineType({
  name: 'sectionGallery',
  title: 'Galerija',
  type: 'object',
  icon: ImagesIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string'}),
    defineField({
      name: 'gallery',
      title: 'Obstoječa galerija',
      type: 'reference',
      to: [{type: 'gallery'}],
      description: 'Izberite galerijo ali spodaj dodajte fotografije samo za to stran.',
    }),
    defineField({
      name: 'images',
      title: 'Fotografije',
      type: 'array',
      of: [defineArrayMember({type: 'imageWithAlt'})],
      options: {layout: 'grid'},
      hidden: ({parent}) => Boolean(parent?.gallery?._ref),
    }),
  ],
  validation: (rule) =>
    rule.custom((value) => {
      const v = value as {gallery?: {_ref?: string}; images?: unknown[]} | undefined
      if (!v?.gallery?._ref && !(v?.images && v.images.length)) return 'Izberite galerijo ali dodajte fotografije.'
      return true
    }),
  preview: {
    select: {title: 'title', galleryTitle: 'gallery.title', first: 'images.0'},
    prepare({title, galleryTitle, first}) {
      return {title: title || galleryTitle || 'Galerija', subtitle: 'Galerija', media: first}
    },
  },
})

export const sectionPeople = defineType({
  name: 'sectionPeople',
  title: 'Osebe',
  type: 'object',
  icon: UsersIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string'}),
    defineField({
      name: 'people',
      title: 'Osebe',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'person'}]})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'title', people: 'people'},
    prepare({title, people}) {
      const n = Array.isArray(people) ? people.length : 0
      return {title: title || 'Osebe', subtitle: `Osebe · ${n}`}
    },
  },
})

export const sectionChurches = defineType({
  name: 'sectionChurches',
  title: 'Cerkve',
  type: 'object',
  icon: HomeIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string', initialValue: 'Naše cerkve'}),
    defineField({
      name: 'churches',
      title: 'Cerkve',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'church'}]})],
      description: 'Pustite prazno za prikaz vseh cerkva.',
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Cerkve', subtitle: 'Cerkve'}
    },
  },
})

export const sectionFaq = defineType({
  name: 'sectionFaq',
  title: 'Pogosta vprašanja',
  type: 'object',
  icon: HelpCircleIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string', initialValue: 'Pogosta vprašanja'}),
    defineField({
      name: 'items',
      title: 'Vprašanja',
      type: 'array',
      of: [defineArrayMember({type: 'faqItem'})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'title', items: 'items'},
    prepare({title, items}) {
      const n = Array.isArray(items) ? items.length : 0
      return {title: title || 'Pogosta vprašanja', subtitle: `Pogosta vprašanja · ${n}`}
    },
  },
})

export const sectionDocuments = defineType({
  name: 'sectionDocuments',
  title: 'Dokumenti',
  type: 'object',
  icon: DocumentIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string', initialValue: 'Dokumenti'}),
    defineField({
      name: 'documents',
      title: 'Dokumenti',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'parishDocument'}]})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'title', documents: 'documents'},
    prepare({title, documents}) {
      const n = Array.isArray(documents) ? documents.length : 0
      return {title: title || 'Dokumenti', subtitle: `Dokumenti · ${n}`}
    },
  },
})

export const sectionContact = defineType({
  name: 'sectionContact',
  title: 'Kontakt',
  type: 'object',
  icon: EnvelopeIcon,
  description: 'Prikaže kontaktne podatke in uradne ure iz nastavitev župnije.',
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string', initialValue: 'Kontakt'}),
    defineField({
      name: 'showForm',
      title: 'Prikaži kontaktni obrazec',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Kontakt', subtitle: 'Kontakt (iz nastavitev)'}
    },
  },
})

export const sectionEvents = defineType({
  name: 'sectionEvents',
  title: 'Prihajajoči dogodki',
  type: 'object',
  icon: CalendarIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string', initialValue: 'Prihajajoči dogodki'}),
    defineField({
      name: 'limit',
      title: 'Največ dogodkov',
      type: 'number',
      initialValue: 4,
      validation: (rule) => rule.min(1).max(12),
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Prihajajoči dogodki', subtitle: 'Dogodki (samodejno)'}
    },
  },
})

export const sectionMassSchedule = defineType({
  name: 'sectionMassSchedule',
  title: 'Urnik svetih maš',
  type: 'object',
  icon: ClockIcon,
  description: 'Prikaže trenutno veljaven redni urnik.',
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string', initialValue: 'Svete maše'}),
    defineField({
      name: 'church',
      title: 'Samo za cerkev',
      type: 'reference',
      to: [{type: 'church'}],
      description: 'Neobvezno. Pustite prazno za vse cerkve.',
    }),
  ],
  preview: {
    select: {title: 'title', church: 'church.shortName'},
    prepare({title, church}) {
      return {title: title || 'Urnik svetih maš', subtitle: church ? `Urnik · ${church}` : 'Urnik (samodejno)'}
    },
  },
})

export const sectionCta = defineType({
  name: 'sectionCta',
  title: 'Poziv s povezavo',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({name: 'title', title: 'Naslov', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'text', title: 'Besedilo', type: 'text', rows: 2, validation: (rule) => rule.max(240)}),
    defineField({name: 'link', title: 'Povezava', type: 'link', validation: (rule) => rule.required()}),
  ],
  preview: {
    select: {title: 'title', label: 'link.label'},
    prepare({title, label}) {
      return {title: title || 'Poziv', subtitle: label ? `Poziv · ${label}` : 'Poziv'}
    },
  },
})

export const pageSections = defineType({
  name: 'pageSections',
  title: 'Odseki strani',
  type: 'array',
  of: [
    defineArrayMember({type: 'sectionHero'}),
    defineArrayMember({type: 'sectionRichText'}),
    defineArrayMember({type: 'sectionTextImage'}),
    defineArrayMember({type: 'sectionQuote'}),
    defineArrayMember({type: 'sectionGallery'}),
    defineArrayMember({type: 'sectionPeople'}),
    defineArrayMember({type: 'sectionChurches'}),
    defineArrayMember({type: 'sectionFaq'}),
    defineArrayMember({type: 'sectionDocuments'}),
    defineArrayMember({type: 'sectionContact'}),
    defineArrayMember({type: 'sectionEvents'}),
    defineArrayMember({type: 'sectionMassSchedule'}),
    defineArrayMember({type: 'sectionCta'}),
  ],
  options: {
    insertMenu: {
      views: [{name: 'list'}],
      groups: [
        {name: 'text', title: 'Besedilo', of: ['sectionRichText', 'sectionTextImage', 'sectionQuote', 'sectionFaq']},
        {name: 'media', title: 'Slike', of: ['sectionHero', 'sectionGallery']},
        {
          name: 'parish',
          title: 'Iz župnijskih podatkov',
          of: ['sectionPeople', 'sectionChurches', 'sectionDocuments', 'sectionContact', 'sectionEvents', 'sectionMassSchedule'],
        },
        {name: 'action', title: 'Poziv', of: ['sectionCta']},
      ],
    },
  },
})

export const sectionTypes = [
  sectionHero,
  sectionRichText,
  sectionTextImage,
  sectionQuote,
  sectionGallery,
  sectionPeople,
  sectionChurches,
  sectionFaq,
  sectionDocuments,
  sectionContact,
  sectionEvents,
  sectionMassSchedule,
  sectionCta,
  pageSections,
]
