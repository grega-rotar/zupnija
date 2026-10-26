import {defineField, defineType} from 'sanity'
import {HelpCircleIcon} from '@sanity/icons/HelpCircle'

export const faqItem = defineType({
  name: 'faqItem',
  title: 'Vprašanje in odgovor',
  type: 'object',
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: 'question',
      title: 'Vprašanje',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'answer',
      title: 'Odgovor',
      type: 'simpleBlockContent',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'question'},
  },
})
