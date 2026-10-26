// Objects
import {address} from './objects/address'
import {attachment} from './objects/attachment'
import {blockContent, simpleBlockContent} from './objects/blockContent'
import {faqItem} from './objects/faqItem'
import {imageWithAlt} from './objects/imageWithAlt'
import {link} from './objects/link'
import {massIntention, massOccurrence, massScheduleEntry} from './objects/mass'
import {openingHours} from './objects/openingHours'
import {pageHeader} from './objects/pageHeader'
import {seo} from './objects/seo'

// Page sections
import {sectionTypes} from './sections'

// Documents
import {announcement} from './documents/announcement'
import {article} from './documents/article'
import {catechesisGroup, catechesisPage} from './documents/catechesis'
import {church} from './documents/church'
import {event} from './documents/event'
import {gallery} from './documents/gallery'
import {homePage} from './documents/homePage'
import {massDay} from './documents/massDay'
import {massSchedule} from './documents/massSchedule'
import {page} from './documents/page'
import {parishDocument} from './documents/parishDocument'
import {parishGroup} from './documents/parishGroup'
import {person} from './documents/person'
import {sacrament} from './documents/sacrament'
import {settings} from './documents/settings'
import {specialPeriod} from './documents/specialPeriod'
import {weeklyBulletin} from './documents/weeklyBulletin'

/** Document types that exist exactly once (fixed ids, managed in structure). */
export const SINGLETON_TYPES = ['settings', 'homePage', 'catechesisPage'] as const

export const schemaTypes = [
  // objects
  address,
  attachment,
  blockContent,
  simpleBlockContent,
  faqItem,
  imageWithAlt,
  link,
  massIntention,
  massOccurrence,
  massScheduleEntry,
  openingHours,
  pageHeader,
  seo,
  ...sectionTypes,
  // documents
  settings,
  homePage,
  catechesisPage,
  church,
  person,
  massSchedule,
  massDay,
  specialPeriod,
  announcement,
  weeklyBulletin,
  event,
  article,
  gallery,
  parishDocument,
  catechesisGroup,
  parishGroup,
  sacrament,
  page,
]
