import {defineField, defineType} from 'sanity'
import {PinIcon} from '@sanity/icons/Pin'

export const address = defineType({
  name: 'address',
  title: 'Naslov',
  type: 'object',
  icon: PinIcon,
  fields: [
    defineField({name: 'street', title: 'Ulica in hišna številka', type: 'string'}),
    defineField({name: 'postalCode', title: 'Poštna številka', type: 'string'}),
    defineField({name: 'city', title: 'Kraj', type: 'string'}),
  ],
  preview: {
    select: {street: 'street', postalCode: 'postalCode', city: 'city'},
    prepare({street, postalCode, city}) {
      const line = [street, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      return {title: line || 'Naslov'}
    },
  },
})
