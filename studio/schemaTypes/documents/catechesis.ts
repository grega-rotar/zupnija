import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons/Book'
import {UsersIcon} from '@sanity/icons/Users'
import {WEEKDAYS, WEEKDAY_LABEL} from '../../lib/constants'

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/

/** Singleton: general catechesis information (enrolment, contact, documents). */
export const catechesisPage = defineType({
  name: 'catechesisPage',
  title: 'Verouk — splošno',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov strani',
      type: 'string',
      initialValue: 'Verouk',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'schoolYear',
      title: 'Tekoče veroučno leto',
      type: 'string',
      description: 'Npr. »2026/2027«. Prikazane so skupine tega leta.',
      validation: (rule) => rule.required().regex(/^\d{4}\/\d{4}$/).error('Oblika: 2026/2027'),
    }),
    defineField({
      name: 'intro',
      title: 'Uvod',
      type: 'blockContent',
      description: 'Kaj je verouk, kdo je vabljen, kdaj se začne.',
    }),
    defineField({
      name: 'enrollment',
      title: 'Vpis',
      type: 'blockContent',
      description: 'Kako in kdaj se vpisati, kaj prinesti.',
    }),
    defineField({
      name: 'contact',
      title: 'Kontaktna oseba',
      type: 'reference',
      to: [{type: 'person'}],
    }),
    defineField({
      name: 'documents',
      title: 'Dokumenti',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'parishDocument'}]})],
      description: 'Prijavnice, urniki v PDF, pravila.',
    }),
    defineField({
      name: 'notice',
      title: 'Aktualno obvestilo',
      type: 'simpleBlockContent',
      description: 'Kratko obvestilo na vrhu strani, npr. »Ta teden verouka ni.« Izbrišite, ko ni več aktualno.',
    }),
    defineField({name: 'image', title: 'Slika', type: 'imageWithAlt'}),
    defineField({name: 'seo', title: 'Iskalniki in deljenje', type: 'seo'}),
  ],
  preview: {
    select: {year: 'schoolYear'},
    prepare({year}) {
      return {title: 'Verouk — splošno', subtitle: year}
    },
  },
})

/** One catechesis group: grade, catechist, weekday, time, location. */
export const catechesisGroup = defineType({
  name: 'catechesisGroup',
  title: 'Veroučna skupina',
  type: 'document',
  icon: UsersIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Skupina',
      type: 'string',
      description: 'Npr. »1. razred«, »Birmanci (8. razred)«, »Predšolski«.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'grade',
      title: 'Razred (številka)',
      type: 'number',
      description: 'Za razvrščanje. Predšolski = 0, 1. razred = 1 …',
      validation: (rule) => rule.min(0).max(9),
    }),
    defineField({
      name: 'schoolYear',
      title: 'Veroučno leto',
      type: 'string',
      description: 'Npr. »2026/2027«',
      validation: (rule) => rule.required().regex(/^\d{4}\/\d{4}$/).error('Oblika: 2026/2027'),
    }),
    defineField({
      name: 'catechist',
      title: 'Katehet / katehistinja',
      type: 'reference',
      to: [{type: 'person'}],
    }),
    defineField({
      name: 'catechistName',
      title: 'Katehet (besedilo)',
      type: 'string',
      description: 'Če kateheta ni med osebami.',
    }),
    defineField({
      name: 'sessions',
      title: 'Termini',
      type: 'array',
      description: 'Večina skupin ima en termin. Dodajte več, če je skupina razdeljena.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'session',
          fields: [
            defineField({
              name: 'weekday',
              title: 'Dan',
              type: 'string',
              options: {list: [...WEEKDAYS]},
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'time',
              title: 'Ura',
              type: 'string',
              description: 'Npr. 16:00',
              validation: (rule) => rule.required().regex(TIME_PATTERN).error('Oblika: 16:00'),
            }),
            defineField({
              name: 'location',
              title: 'Prostor',
              type: 'string',
              description: 'Npr. »Veroučna učilnica 1« ali »Župnišče«.',
            }),
          ],
          preview: {
            select: {weekday: 'weekday', time: 'time', location: 'location'},
            prepare({weekday, time, location}) {
              return {title: `${WEEKDAY_LABEL[weekday] ?? ''} ${time ?? ''}`.trim(), subtitle: location}
            },
          },
        }),
      ],
      validation: (rule) => rule.min(1).error('Dodajte vsaj en termin.'),
    }),
    defineField({
      name: 'notes',
      title: 'Opombe',
      type: 'simpleBlockContent',
      description: 'Npr. priprava na zakrament, potrebščine, posebnosti.',
    }),
    defineField({
      name: 'documents',
      title: 'Dokumenti za to skupino',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'parishDocument'}]})],
    }),
  ],
  orderings: [{title: 'Po razredu', name: 'grade', by: [{field: 'grade', direction: 'asc'}]}],
  preview: {
    select: {
      title: 'title',
      year: 'schoolYear',
      catechist: 'catechist.name',
      catechistName: 'catechistName',
      weekday: 'sessions.0.weekday',
      time: 'sessions.0.time',
    },
    prepare({title, year, catechist, catechistName, weekday, time}) {
      return {
        title,
        subtitle: [year, weekday ? `${WEEKDAY_LABEL[weekday]} ${time ?? ''}` : null, catechist || catechistName]
          .filter(Boolean)
          .join(' · '),
      }
    },
  },
})
