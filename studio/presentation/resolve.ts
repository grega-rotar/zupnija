import {defineLocations, type PresentationPluginOptions} from 'sanity/presentation'

/**
 * Tells the Presentation tool where each document appears on the website,
 * so editors can jump from a document to its live preview.
 */
export const resolve: PresentationPluginOptions['resolve'] = {
  locations: {
    settings: defineLocations({
      message: 'Nastavitve se uporabljajo na vseh straneh.',
      tone: 'positive',
    }),
    homePage: defineLocations({
      locations: [{title: 'Domača stran', href: '/'}],
    }),
    catechesisPage: defineLocations({
      locations: [{title: 'Verouk', href: '/verouk'}],
    }),
    catechesisGroup: defineLocations({
      locations: [{title: 'Verouk', href: '/verouk'}],
    }),
    massSchedule: defineLocations({
      locations: [
        {title: 'Svete maše', href: '/svete-mase'},
        {title: 'Domača stran', href: '/'},
      ],
    }),
    massDay: defineLocations({
      select: {date: 'date'},
      resolve: (doc) => ({
        locations: [
          {title: 'Mašni nameni', href: doc?.date ? `/masni-nameni?teden=${doc.date}` : '/masni-nameni'},
          {title: 'Svete maše', href: '/svete-mase'},
        ],
      }),
    }),
    announcement: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Oznanilo', href: `/oznanila/${doc?.slug}`},
          {title: 'Oznanila', href: '/oznanila'},
          {title: 'Domača stran', href: '/'},
        ],
      }),
    }),
    weeklyBulletin: defineLocations({
      select: {weekStart: 'weekStart'},
      resolve: (doc) => ({
        locations: [
          {title: 'Tedenska oznanila', href: `/oznanila/teden/${doc?.weekStart}`},
          {title: 'Oznanila', href: '/oznanila'},
        ],
      }),
    }),
    event: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Dogodek', href: `/dogodki/${doc?.slug}`},
          {title: 'Dogodki', href: '/dogodki'},
        ],
      }),
    }),
    article: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Novica', href: `/novice/${doc?.slug}`},
          {title: 'Novice', href: '/novice'},
        ],
      }),
    }),
    gallery: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Galerija', href: `/galerije/${doc?.slug}`},
          {title: 'Galerije', href: '/galerije'},
        ],
      }),
    }),
    church: defineLocations({
      select: {title: 'name', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Cerkev', href: `/zupnija/cerkve/${doc?.slug}`},
          {title: 'Cerkve', href: '/zupnija/cerkve'},
        ],
      }),
    }),
    person: defineLocations({
      locations: [{title: 'Duhovniki in sodelavci', href: '/zupnija/duhovniki'}],
    }),
    parishGroup: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Skupina', href: `/zupnija/skupine/${doc?.slug}`},
          {title: 'Skupine', href: '/zupnija/skupine'},
        ],
      }),
    }),
    sacrament: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Zakrament', href: `/zakramenti/${doc?.slug}`},
          {title: 'Zakramenti', href: '/zakramenti'},
        ],
      }),
    }),
    specialPeriod: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [
          {title: doc?.title || 'Posebno obdobje', href: `/obdobje/${doc?.slug}`},
          {title: 'Domača stran', href: '/'},
        ],
      }),
    }),
    parishDocument: defineLocations({
      locations: [{title: 'Dokumenti', href: '/dokumenti'}],
    }),
    page: defineLocations({
      select: {title: 'title', slug: 'slug.current'},
      resolve: (doc) => ({
        locations: [{title: doc?.title || 'Stran', href: `/${doc?.slug}`}],
      }),
    }),
  },
}
