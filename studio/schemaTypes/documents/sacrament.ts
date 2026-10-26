import {defineArrayMember, defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons/Star'
import {SACRAMENT_KINDS} from '../../lib/constants'

/** Informational page for one sacrament or pastoral service. */
export const sacrament = defineType({
  name: 'sacrament',
  title: 'Zakrament',
  type: 'document',
  icon: StarIcon,
  groups: [
    {name: 'basic', title: 'Osnovno', default: true},
    {name: 'process', title: 'Postopek'},
    {name: 'seo', title: 'Iskalniki'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov',
      type: 'string',
      group: 'basic',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      group: 'basic',
      options: {source: 'title', maxLength: 60},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      title: 'Vrsta',
      type: 'string',
      group: 'basic',
      options: {list: [...SACRAMENT_KINDS]},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Kratek opis',
      type: 'text',
      rows: 2,
      group: 'basic',
      validation: (rule) => rule.required().max(240),
    }),
    defineField({name: 'image', title: 'Slika', type: 'imageWithAlt', group: 'basic'}),
    defineField({
      name: 'description',
      title: 'Kaj je to',
      type: 'blockContent',
      group: 'basic',
    }),
    defineField({
      name: 'contact',
      title: 'Na koga se obrniti',
      type: 'reference',
      to: [{type: 'person'}],
      group: 'basic',
    }),
    defineField({
      name: 'contactNote',
      title: 'Kako se dogovoriti',
      type: 'simpleBlockContent',
      group: 'basic',
      description: 'Npr. »Oglasite se v župnišču v času uradnih ur vsaj mesec dni prej.«',
    }),
    defineField({
      name: 'requirements',
      title: 'Pogoji',
      type: 'array',
      group: 'process',
      of: [defineArrayMember({type: 'string'})],
      description: 'Vsak pogoj v svojo vrstico.',
    }),
    defineField({
      name: 'steps',
      title: 'Koraki',
      type: 'array',
      group: 'process',
      description: 'Postopek po vrsti, npr. 1. Prijava, 2. Priprava, 3. Obred.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'step',
          fields: [
            defineField({name: 'title', title: 'Korak', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'text', title: 'Opis', type: 'simpleBlockContent'}),
          ],
          preview: {select: {title: 'title'}},
        }),
      ],
    }),
    defineField({
      name: 'documentsNeeded',
      title: 'Potrebni dokumenti',
      type: 'array',
      group: 'process',
      of: [defineArrayMember({type: 'string'})],
      description: 'Npr. »Krstni list«, »Potrdilo o civilni poroki«.',
    }),
    defineField({
      name: 'downloads',
      title: 'Obrazci in dokumenti za prenos',
      type: 'array',
      group: 'process',
      of: [defineArrayMember({type: 'reference', to: [{type: 'parishDocument'}]})],
    }),
    defineField({
      name: 'faq',
      title: 'Pogosta vprašanja',
      type: 'array',
      group: 'process',
      of: [defineArrayMember({type: 'faqItem'})],
    }),
    defineField({
      name: 'links',
      title: 'Koristne povezave',
      type: 'array',
      group: 'process',
      of: [defineArrayMember({type: 'link'})],
    }),
    defineField({
      name: 'order',
      title: 'Vrstni red',
      type: 'number',
      group: 'basic',
      initialValue: 10,
    }),
    defineField({name: 'seo', title: 'Iskalniki in deljenje', type: 'seo', group: 'seo'}),
  ],
  orderings: [{title: 'Vrstni red', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {
    select: {title: 'title', kind: 'kind', media: 'image'},
    prepare({title, kind, media}) {
      return {title, subtitle: SACRAMENT_KINDS.find((k) => k.value === kind)?.title, media}
    },
  },
})
