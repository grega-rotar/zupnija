import {defineArrayMember, defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons/Users'

export const parishGroup = defineType({
  name: 'parishGroup',
  title: 'Skupina',
  type: 'document',
  icon: UsersIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Ime skupine',
      type: 'string',
      description: 'Npr. »Mešani pevski zbor«, »Ministranti«, »Župnijska Karitas«.',
      validation: (rule) => rule.required().max(80),
    }),
    defineField({
      name: 'slug',
      title: 'Spletni naslov',
      type: 'slug',
      options: {source: 'title', maxLength: 80},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Kratek opis',
      type: 'text',
      rows: 2,
      description: 'Ena ali dve povedi za seznam skupin.',
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: 'description',
      title: 'Predstavitev',
      type: 'blockContent',
    }),
    defineField({
      name: 'meetingSchedule',
      title: 'Kdaj se srečujemo',
      type: 'string',
      description: 'Npr. »Vsak četrtek ob 19.30« ali »Po dogovoru«.',
    }),
    defineField({
      name: 'location',
      title: 'Kje',
      type: 'string',
      description: 'Npr. »Župnijska dvorana« ali »Cerkev sv. Križa«.',
    }),
    defineField({
      name: 'contactPerson',
      title: 'Kontaktna oseba',
      type: 'reference',
      to: [{type: 'person'}],
    }),
    defineField({
      name: 'contactName',
      title: 'Kontakt (ime)',
      type: 'string',
      description: 'Če kontaktna oseba ni med osebami.',
    }),
    defineField({
      name: 'email',
      title: 'E-pošta',
      type: 'string',
      validation: (rule) => rule.email().error('Vnesite veljaven e-poštni naslov.'),
    }),
    defineField({name: 'phone', title: 'Telefon', type: 'string'}),
    defineField({
      name: 'links',
      title: 'Povezave',
      type: 'array',
      of: [defineArrayMember({type: 'link'})],
    }),
    defineField({name: 'image', title: 'Slika', type: 'imageWithAlt'}),
    defineField({
      name: 'gallery',
      title: 'Galerija',
      type: 'array',
      of: [defineArrayMember({type: 'imageWithAlt'})],
      options: {layout: 'grid'},
    }),
    defineField({
      name: 'order',
      title: 'Vrstni red',
      type: 'number',
      initialValue: 10,
    }),
    defineField({name: 'seo', title: 'Iskalniki in deljenje', type: 'seo'}),
  ],
  orderings: [{title: 'Vrstni red', name: 'order', by: [{field: 'order', direction: 'asc'}]}],
  preview: {
    select: {title: 'title', subtitle: 'meetingSchedule', media: 'image'},
  },
})
