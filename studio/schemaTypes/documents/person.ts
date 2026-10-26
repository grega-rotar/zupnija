import {defineField, defineType} from 'sanity'
import {UserIcon} from '@sanity/icons/User'
import {PERSON_ROLES} from '../../lib/constants'

export const person = defineType({
  name: 'person',
  title: 'Oseba',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'name',
      title: 'Ime in priimek',
      type: 'string',
      description: 'Z nazivom, če je primerno, npr. »Janez Novak, župnik« se zapiše samo »Janez Novak«.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      options: {source: 'name', maxLength: 80},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Vloga',
      type: 'string',
      options: {list: [...PERSON_ROLES]},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'roleTitle',
      title: 'Naziv (prikazano)',
      type: 'string',
      description: 'Neobvezno. Če želite drugačen zapis od izbrane vloge, npr. »župnik in dekan«.',
    }),
    defineField({
      name: 'photo',
      title: 'Fotografija',
      type: 'imageWithAlt',
    }),
    defineField({
      name: 'bio',
      title: 'Predstavitev',
      type: 'simpleBlockContent',
    }),
    defineField({
      name: 'email',
      title: 'E-pošta',
      type: 'string',
      validation: (rule) => rule.email().error('Vnesite veljaven e-poštni naslov.'),
    }),
    defineField({name: 'phone', title: 'Telefon', type: 'string'}),
    defineField({
      name: 'showContact',
      title: 'Prikaži kontakt na spletni strani',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'order',
      title: 'Vrstni red',
      type: 'number',
      description: 'Manjša številka je prikazana prej.',
      initialValue: 10,
    }),
  ],
  orderings: [{title: 'Vrstni red', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {
    select: {title: 'name', role: 'role', roleTitle: 'roleTitle', media: 'photo'},
    prepare({title, role, roleTitle, media}) {
      return {
        title,
        subtitle: roleTitle || PERSON_ROLES.find((r) => r.value === role)?.title,
        media,
      }
    },
  },
})
