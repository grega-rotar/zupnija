import {defineArrayMember, defineField, defineType} from 'sanity'
import {CogIcon} from '@sanity/icons/Cog'

/**
 * Singleton: parish-wide information used everywhere on the website.
 * Fixed document id »settings« (see structure).
 */
export const settings = defineType({
  name: 'settings',
  title: 'Nastavitve župnije',
  type: 'document',
  icon: CogIcon,
  groups: [
    {name: 'parish', title: 'Župnija', default: true},
    {name: 'contact', title: 'Kontakt in uradne ure'},
    {name: 'donations', title: 'Darovi'},
    {name: 'web', title: 'Spletna stran'},
    {name: 'headers', title: 'Glave strani'},
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Ime župnije',
      type: 'string',
      group: 'parish',
      initialValue: 'Župnija Pirniče',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tagline',
      title: 'Kratek opis župnije',
      type: 'text',
      rows: 2,
      group: 'parish',
      description: 'Ena poved, ki se prikaže v nogi in pri deljenju na družbenih omrežjih.',
      validation: (rule) => rule.max(200),
    }),
    defineField({
      name: 'diocese',
      title: 'Škofija / dekanija',
      type: 'string',
      group: 'parish',
      description: 'Npr. »Nadškofija Ljubljana, dekanija Ljubljana - Šentvid«.',
    }),
    defineField({
      name: 'pastor',
      title: 'Župnik',
      type: 'reference',
      to: [{type: 'person'}],
      group: 'parish',
    }),
    defineField({
      name: 'address',
      title: 'Naslov župnišča',
      type: 'address',
      group: 'contact',
    }),
    defineField({
      name: 'phone',
      title: 'Telefon',
      type: 'string',
      group: 'contact',
    }),
    defineField({
      name: 'mobile',
      title: 'Mobilni telefon',
      type: 'string',
      group: 'contact',
    }),
    defineField({
      name: 'email',
      title: 'E-pošta',
      type: 'string',
      group: 'contact',
      validation: (rule) => rule.email().error('Vnesite veljaven e-poštni naslov.'),
    }),
    defineField({
      name: 'contactFormRecipient',
      title: 'Prejemnik sporočil s spletnega obrazca',
      type: 'string',
      group: 'contact',
      description: 'E-poštni naslov, kamor prispejo sporočila s kontaktnega obrazca. Ni javno prikazan.',
      validation: (rule) => rule.email().error('Vnesite veljaven e-poštni naslov.'),
    }),
    defineField({
      name: 'officeHours',
      title: 'Uradne ure',
      type: 'array',
      group: 'contact',
      of: [defineArrayMember({type: 'openingHours'})],
    }),
    defineField({
      name: 'officeHoursNote',
      title: 'Opomba k uradnim uram',
      type: 'simpleBlockContent',
      group: 'contact',
      description: 'Npr. »Ob praznikih uradnih ur ni. Za nujne primere pokličite.«',
    }),
    defineField({
      name: 'emergencyContact',
      title: 'Nujni primeri',
      type: 'object',
      group: 'contact',
      description: 'Prikazano pri kontaktu in pri bolniškem maziljenju / pogrebu.',
      fields: [
        defineField({name: 'label', title: 'Besedilo', type: 'string', initialValue: 'Za bolniško maziljenje in pogreb'}),
        defineField({name: 'phone', title: 'Telefon', type: 'string'}),
      ],
    }),
    defineField({
      name: 'socialLinks',
      title: 'Družbena omrežja',
      type: 'array',
      group: 'contact',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'socialLink',
          fields: [
            defineField({
              name: 'platform',
              title: 'Omrežje',
              type: 'string',
              options: {
                list: [
                  {title: 'Facebook', value: 'facebook'},
                  {title: 'Instagram', value: 'instagram'},
                  {title: 'YouTube', value: 'youtube'},
                  {title: 'Drugo', value: 'other'},
                ],
              },
              validation: (rule) => rule.required(),
            }),
            defineField({name: 'label', title: 'Ime (za »Drugo«)', type: 'string'}),
            defineField({
              name: 'url',
              title: 'Povezava',
              type: 'url',
              validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
            }),
          ],
          preview: {
            select: {title: 'platform', subtitle: 'url', label: 'label'},
            prepare({title, subtitle, label}) {
              return {title: label || title, subtitle}
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'donations',
      title: 'Darovi za župnijo',
      type: 'object',
      group: 'donations',
      fields: [
        defineField({name: 'intro', title: 'Besedilo', type: 'simpleBlockContent'}),
        defineField({name: 'recipient', title: 'Prejemnik', type: 'string'}),
        defineField({name: 'iban', title: 'IBAN', type: 'string'}),
        defineField({name: 'bic', title: 'BIC / SWIFT', type: 'string'}),
        defineField({name: 'reference', title: 'Sklic', type: 'string'}),
        defineField({name: 'purpose', title: 'Namen nakazila', type: 'string', initialValue: 'Dar za župnijo'}),
      ],
    }),
    ...[
      ['massesHeader', 'Svete maše'],
      ['announcementsHeader', 'Oznanila'],
      ['eventsHeader', 'Dogodki'],
      ['parishHeader', 'Župnija'],
      ['catechesisHeader', 'Verouk'],
      ['contactHeader', 'Kontakt'],
    ].map(([name, title]) =>
      defineField({
        name,
        title: `Glava strani: ${title}`,
        type: 'pageHeader',
        group: 'headers',
      }),
    ),
    defineField({
      name: 'siteUrl',
      title: 'Naslov spletne strani',
      type: 'url',
      group: 'web',
      description: 'Npr. https://zupnija-pirnice.si — uporabi se pri deljenju in v zemljevidu strani.',
      validation: (rule) => rule.uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'seo',
      title: 'Privzete nastavitve za iskalnike',
      type: 'seo',
      group: 'web',
      description: 'Uporabijo se, kadar posamezna vsebina nima svojih nastavitev.',
    }),
    defineField({
      name: 'footerText',
      title: 'Besedilo v nogi',
      type: 'simpleBlockContent',
      group: 'web',
      description: 'Neobvezno, npr. kratka misel ali navedba avtorstva fotografij.',
    }),
    defineField({
      name: 'privacyPage',
      title: 'Stran z izjavo o zasebnosti',
      type: 'reference',
      to: [{type: 'page'}],
      group: 'web',
    }),
    defineField({
      name: 'legalPage',
      title: 'Stran s pravnimi informacijami',
      type: 'reference',
      to: [{type: 'page'}],
      group: 'web',
    }),
  ],
  preview: {
    prepare: () => ({title: 'Nastavitve župnije'}),
  },
})
