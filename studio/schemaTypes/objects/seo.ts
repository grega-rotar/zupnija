import {defineField, defineType} from 'sanity'
import {SearchIcon} from '@sanity/icons/Search'

export const seo = defineType({
  name: 'seo',
  title: 'Iskalniki in deljenje',
  type: 'object',
  icon: SearchIcon,
  options: {collapsible: true, collapsed: true},
  fields: [
    defineField({
      name: 'title',
      title: 'Naslov za iskalnike',
      type: 'string',
      description: 'Neobvezno. Če je prazno, se uporabi naslov vsebine.',
      validation: (rule) => rule.max(70).warning('Iskalniki prikažejo največ okoli 60–70 znakov.'),
    }),
    defineField({
      name: 'description',
      title: 'Kratek opis za iskalnike',
      type: 'text',
      rows: 3,
      description: 'Neobvezno. Ena ali dve povedi, ki opišeta vsebino strani.',
      validation: (rule) => rule.max(170).warning('Priporočeno je do 160 znakov.'),
    }),
    defineField({
      name: 'image',
      title: 'Slika za deljenje',
      type: 'image',
      description:
        'Neobvezno. Uporabi se pri deljenju na družbenih omrežjih (priporočeno 1200 × 630).',
      options: {hotspot: true},
    }),
    defineField({
      name: 'noIndex',
      title: 'Skrij pred iskalniki',
      type: 'boolean',
      description: 'Vklopi samo izjemoma (npr. začasne ali interne strani).',
      initialValue: false,
    }),
  ],
})
