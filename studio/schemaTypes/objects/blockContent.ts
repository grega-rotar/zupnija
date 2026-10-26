import {defineArrayMember, defineField, defineType} from 'sanity'

const linkAnnotation = {
  name: 'link',
  title: 'Povezava',
  type: 'object',
  fields: [
    defineField({
      name: 'href',
      title: 'Spletni naslov',
      type: 'url',
      validation: (rule) =>
        rule.uri({scheme: ['http', 'https', 'mailto', 'tel'], allowRelative: true}),
    }),
  ],
}

/**
 * Rich text used across the site. Deliberately limited: headings h2/h3,
 * lists, bold/italic, links, images and attachments. No colours, no HTML.
 */
export const blockContent = defineType({
  name: 'blockContent',
  title: 'Besedilo',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Odstavek', value: 'normal'},
        {title: 'Naslov', value: 'h2'},
        {title: 'Podnaslov', value: 'h3'},
        {title: 'Citat', value: 'blockquote'},
      ],
      lists: [
        {title: 'Seznam', value: 'bullet'},
        {title: 'Oštevilčen seznam', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Krepko', value: 'strong'},
          {title: 'Ležeče', value: 'em'},
        ],
        annotations: [linkAnnotation],
      },
    }),
    defineArrayMember({type: 'imageWithAlt', title: 'Slika'}),
    defineArrayMember({type: 'attachment', title: 'Priponka'}),
  ],
})

/** Shorter rich text without images — for notes, intros, captions. */
export const simpleBlockContent = defineType({
  name: 'simpleBlockContent',
  title: 'Kratko besedilo',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [{title: 'Odstavek', value: 'normal'}],
      lists: [{title: 'Seznam', value: 'bullet'}],
      marks: {
        decorators: [
          {title: 'Krepko', value: 'strong'},
          {title: 'Ležeče', value: 'em'},
        ],
        annotations: [linkAnnotation],
      },
    }),
  ],
})
