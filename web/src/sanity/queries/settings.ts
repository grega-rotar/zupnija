import { defineQuery } from "next-sanity";
import { pageHeaderFragment, personRefFragment } from "./fragments";

/** Parish-wide settings (singleton). Used by layout, footer, contact, SEO. */
export const SETTINGS_QUERY = defineQuery(/* groq */ `
  *[_type == "settings" && _id == "settings"][0]{
    name,
    tagline,
    diocese,
    pastor->{ ${personRefFragment} },
    address,
    phone,
    mobile,
    email,
    officeHours[]{ _key, weekday, from, to, note },
    officeHoursNote,
    emergencyContact { label, phone },
    socialLinks[]{ _key, platform, label, url },
    donations { intro, recipient, iban, bic, reference, purpose },
    siteUrl,
    massesHeader { ${pageHeaderFragment} },
    announcementsHeader { ${pageHeaderFragment} },
    eventsHeader { ${pageHeaderFragment} },
    parishHeader { ${pageHeaderFragment} },
    catechesisHeader { ${pageHeaderFragment} },
    contactHeader { ${pageHeaderFragment} },
    seo { title, description, image { asset->{ _id, url }, hotspot, crop } },
    footerText,
    privacyPage->{ title, "slug": slug.current },
    legalPage->{ title, "slug": slug.current }
  }
`);

/** Server-only: where contact form messages are delivered. */
export const CONTACT_RECIPIENT_QUERY = defineQuery(/* groq */ `
  *[_type == "settings" && _id == "settings"][0]{
    "recipient": coalesce(contactFormRecipient, email),
    name
  }
`);

/** Active special period (Advent, Christmas …) for today, if any. */
export const ACTIVE_SPECIAL_PERIOD_QUERY = defineQuery(/* groq */ `
  *[_type == "specialPeriod" && activeFrom <= $today && activeUntil >= $today]
    | order(activeFrom desc)[0]{
    _id,
    title,
    "slug": slug.current,
    season,
    activeFrom,
    activeUntil,
    officeHoursNote,
    "excerpt": pt::text(message)
  }
`);

/** Urgent announcements shown in the top banner. */
export const URGENT_ANNOUNCEMENTS_QUERY = defineQuery(/* groq */ `
  *[
    _type == "announcement"
    && importance == "urgent"
    && publishFrom <= $now
    && (!defined(publishUntil) || publishUntil >= $now)
  ] | order(publishFrom desc)[0...2]{
    _id,
    title,
    "slug": slug.current,
    summary
  }
`);
