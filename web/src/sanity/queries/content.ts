import { defineQuery } from "next-sanity";
import {
  announcementCardFragment,
  articleCardFragment,
  attachmentFragment,
  blockContentFragment,
  churchRefFragment,
  eventCardFragment,
  galleryCardFragment,
  imageFragment,
  linkFragment,
  personRefFragment,
  seoFragment,
} from "./fragments";

// ───────────────────────── Announcements ─────────────────────────

const currentAnnouncementFilter = /* groq */ `
  _type == "announcement"
  && publishFrom <= $now
  && (!defined(publishUntil) || publishUntil >= $now)
`;

export const HOME_ANNOUNCEMENTS_QUERY = defineQuery(/* groq */ `
  *[${currentAnnouncementFilter} && showOnHomepage == true]
    | order(select(importance == "urgent" => 0, importance == "important" => 1, 2) asc, publishFrom desc)[0...4]{
    ${announcementCardFragment}
  }
`);

export const CURRENT_ANNOUNCEMENTS_QUERY = defineQuery(/* groq */ `
  *[${currentAnnouncementFilter}]
    | order(select(importance == "urgent" => 0, importance == "important" => 1, 2) asc, publishFrom desc){
    ${announcementCardFragment}
  }
`);

export const ARCHIVED_ANNOUNCEMENTS_QUERY = defineQuery(/* groq */ `
  *[_type == "announcement" && defined(publishUntil) && publishUntil < $now]
    | order(publishFrom desc)[0...60]{
    ${announcementCardFragment}
  }
`);

export const ANNOUNCEMENT_QUERY = defineQuery(/* groq */ `
  *[_type == "announcement" && slug.current == $slug][0]{
    ${announcementCardFragment},
    body[]{ ${blockContentFragment} },
    attachments[]{ ${attachmentFragment} },
    relatedEvent->{ ${eventCardFragment} }
  }
`);

// ───────────────────────── Weekly bulletin ─────────────────────────

const bulletinProjection = /* groq */ `
  _id,
  weekStart,
  "weekEnd": coalesce(weekEnd, weekStart),
  liturgicalNotes,
  items[]{ _key, title, body },
  specialInfo[]{ ${blockContentFragment} },
  events[]->{ ${eventCardFragment} },
  attachments[]{ ${attachmentFragment} }
`;

/** The bulletin covering today, or the most recent one before today. */
export const CURRENT_BULLETIN_QUERY = defineQuery(/* groq */ `
  *[_type == "weeklyBulletin" && weekStart <= $today] | order(weekStart desc)[0]{
    ${bulletinProjection}
  }
`);

export const BULLETIN_BY_WEEK_QUERY = defineQuery(/* groq */ `
  *[_type == "weeklyBulletin" && weekStart == $weekStart][0]{
    ${bulletinProjection}
  }
`);

export const BULLETIN_LIST_QUERY = defineQuery(/* groq */ `
  *[_type == "weeklyBulletin"] | order(weekStart desc)[0...52]{
    _id,
    weekStart,
    "weekEnd": coalesce(weekEnd, weekStart),
    "itemCount": count(items)
  }
`);

// ───────────────────────── Events ─────────────────────────

export const UPCOMING_EVENTS_QUERY = defineQuery(/* groq */ `
  *[_type == "event" && coalesce(end, start) >= $now]
    | order(start asc)[0...30]{
    ${eventCardFragment}
  }
`);

export const HOME_EVENTS_QUERY = defineQuery(/* groq */ `
  *[_type == "event" && coalesce(end, start) >= $now]
    | order(start asc)[0...4]{
    ${eventCardFragment}
  }
`);

export const PAST_EVENTS_QUERY = defineQuery(/* groq */ `
  *[_type == "event" && coalesce(end, start) < $now]
    | order(start desc)[0...40]{
    ${eventCardFragment}
  }
`);

export const EVENT_QUERY = defineQuery(/* groq */ `
  *[_type == "event" && slug.current == $slug][0]{
    ${eventCardFragment},
    description[]{ ${blockContentFragment} },
    organizer->{ _id, title, "slug": slug.current },
    organizerName,
    registration { ${linkFragment} },
    attachments[]{ ${attachmentFragment} },
    church->{ ${churchRefFragment}, address, location },
    "galleries": *[_type == "gallery" && references(^._id)] | order(date desc){ ${galleryCardFragment} },
    ${seoFragment}
  }
`);

/** Events in a date range (weekly bulletin, special periods). */
export const EVENTS_IN_RANGE_QUERY = defineQuery(/* groq */ `
  *[_type == "event" && start >= $from && start <= $to] | order(start asc){
    ${eventCardFragment}
  }
`);

// ───────────────────────── Articles ─────────────────────────

export const ARTICLES_QUERY = defineQuery(/* groq */ `
  *[_type == "article" && publishedAt <= $now] | order(publishedAt desc)[0...40]{
    ${articleCardFragment}
  }
`);

export const HOME_ARTICLES_QUERY = defineQuery(/* groq */ `
  *[_type == "article" && publishedAt <= $now] | order(publishedAt desc)[0...3]{
    ${articleCardFragment}
  }
`);

export const ARTICLE_QUERY = defineQuery(/* groq */ `
  *[_type == "article" && slug.current == $slug][0]{
    ${articleCardFragment},
    body[]{ ${blockContentFragment} },
    author->{ ${personRefFragment} },
    gallery->{
      ${galleryCardFragment},
      images[]{ _key, ${imageFragment} }
    },
    relatedEvent->{ ${eventCardFragment} },
    attachments[]{ ${attachmentFragment} },
    "related": *[_type == "article" && _id != ^._id && publishedAt <= $now] | order(publishedAt desc)[0...3]{
      ${articleCardFragment}
    },
    ${seoFragment}
  }
`);

// ───────────────────────── Galleries ─────────────────────────

export const GALLERIES_QUERY = defineQuery(/* groq */ `
  *[_type == "gallery"] | order(date desc)[0...60]{
    ${galleryCardFragment}
  }
`);

export const HOME_GALLERIES_QUERY = defineQuery(/* groq */ `
  *[_type == "gallery"] | order(date desc)[0...3]{
    ${galleryCardFragment}
  }
`);

export const GALLERY_QUERY = defineQuery(/* groq */ `
  *[_type == "gallery" && slug.current == $slug][0]{
    ${galleryCardFragment},
    description,
    photographer,
    images[]{ _key, ${imageFragment} },
    relatedEvent->{ _id, title, "slug": slug.current, start }
  }
`);

// ───────────────────────── Churches ─────────────────────────

export const CHURCHES_QUERY = defineQuery(/* groq */ `
  *[_type == "church"] | order(order asc, name asc){
    ${churchRefFragment},
    kind,
    dedication,
    patronFeast,
    summary,
    address,
    image { ${imageFragment} }
  }
`);

export const CHURCH_QUERY = defineQuery(/* groq */ `
  *[_type == "church" && slug.current == $slug][0]{
    ${churchRefFragment},
    kind,
    dedication,
    patronFeast,
    summary,
    description[]{ ${blockContentFragment} },
    history[]{ ${blockContentFragment} },
    address,
    location,
    accessibility,
    parking,
    visitNotes,
    image { ${imageFragment} },
    gallery[]{ _key, ${imageFragment} },
    ${seoFragment}
  }
`);

// ───────────────────────── People & groups ─────────────────────────

export const PEOPLE_QUERY = defineQuery(/* groq */ `
  *[_type == "person"] | order(order asc, name asc){
    ${personRefFragment},
    bio
  }
`);

export const GROUPS_QUERY = defineQuery(/* groq */ `
  *[_type == "parishGroup"] | order(order asc, title asc){
    _id,
    title,
    "slug": slug.current,
    summary,
    meetingSchedule,
    location,
    image { ${imageFragment} }
  }
`);

export const GROUP_QUERY = defineQuery(/* groq */ `
  *[_type == "parishGroup" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    summary,
    description[]{ ${blockContentFragment} },
    meetingSchedule,
    location,
    contactPerson->{ ${personRefFragment} },
    contactName,
    email,
    phone,
    links[]{ _key, ${linkFragment} },
    image { ${imageFragment} },
    gallery[]{ _key, ${imageFragment} },
    "events": *[_type == "event" && organizer._ref == ^._id && coalesce(end, start) >= $now] | order(start asc)[0...4]{
      ${eventCardFragment}
    },
    ${seoFragment}
  }
`);

// ───────────────────────── Sacraments ─────────────────────────

export const SACRAMENTS_QUERY = defineQuery(/* groq */ `
  *[_type == "sacrament"] | order(order asc, title asc){
    _id,
    title,
    "slug": slug.current,
    kind,
    summary,
    image { ${imageFragment} }
  }
`);

export const SACRAMENT_QUERY = defineQuery(/* groq */ `
  *[_type == "sacrament" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    kind,
    summary,
    image { ${imageFragment} },
    description[]{ ${blockContentFragment} },
    contact->{ ${personRefFragment} },
    contactNote,
    requirements,
    steps[]{ _key, title, text },
    documentsNeeded,
    downloads[]->{ _id, title, description, file { asset->{ url, extension, size } } },
    faq[]{ _key, question, answer },
    links[]{ _key, ${linkFragment} },
    ${seoFragment}
  }
`);

// ───────────────────────── Catechesis ─────────────────────────

export const CATECHESIS_QUERY = defineQuery(/* groq */ `
  {
    "page": *[_type == "catechesisPage" && _id == "catechesisPage"][0]{
      title,
      schoolYear,
      intro[]{ ${blockContentFragment} },
      enrollment[]{ ${blockContentFragment} },
      contact->{ ${personRefFragment} },
      documents[]->{ _id, title, description, file { asset->{ url, extension, size } } },
      notice,
      image { ${imageFragment} },
      ${seoFragment}
    },
    "groups": *[_type == "catechesisGroup" && schoolYear == *[_type == "catechesisPage" && _id == "catechesisPage"][0].schoolYear]
      | order(grade asc, title asc){
      _id,
      title,
      grade,
      schoolYear,
      catechist->{ ${personRefFragment} },
      catechistName,
      sessions[]{ _key, weekday, time, location },
      notes,
      documents[]->{ _id, title, file { asset->{ url, extension } } }
    }
  }
`);

// ───────────────────────── Documents ─────────────────────────

export const DOCUMENTS_QUERY = defineQuery(/* groq */ `
  *[_type == "parishDocument" && public != false] | order(date desc, title asc){
    _id,
    title,
    category,
    date,
    description,
    file { asset->{ url, extension, size, originalFilename } }
  }
`);

// ───────────────────────── Special periods ─────────────────────────

export const SPECIAL_PERIOD_QUERY = defineQuery(/* groq */ `
  *[_type == "specialPeriod" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    season,
    activeFrom,
    activeUntil,
    officeHoursNote,
    image { ${imageFragment} },
    message[]{ ${blockContentFragment} },
    schedule->{
      _id,
      title,
      validFrom,
      validUntil,
      note,
      entries[]{ _key, weekdays, time, type, note, church->{ ${churchRefFragment} } }
    },
    events[]->{ ${eventCardFragment} },
    announcements[]->{ ${announcementCardFragment} },
    attachments[]{ ${attachmentFragment} }
  }
`);

export const HOME_SPECIAL_PERIOD_QUERY = defineQuery(/* groq */ `
  *[_type == "specialPeriod" && activeFrom <= $today && activeUntil >= $today]
    | order(activeFrom desc)[0]{
    _id,
    title,
    "slug": slug.current,
    season,
    activeFrom,
    activeUntil,
    image { ${imageFragment} },
    "excerpt": pt::text(message),
    "hasSchedule": defined(schedule)
  }
`);

// ───────────────────────── Pages ─────────────────────────

export const PAGE_QUERY = defineQuery(/* groq */ `
  *[_type == "page" && slug.current == $slug][0]{
    _id,
    _type,
    title,
    "slug": slug.current,
    intro,
    sections[]{
      _key,
      _type,
      _type == "sectionHero" => { title, text, image { ${imageFragment} } },
      _type == "sectionRichText" => { title, body[]{ ${blockContentFragment} } },
      _type == "sectionTextImage" => { title, body, imageSide, image { ${imageFragment} }, link { ${linkFragment} } },
      _type == "sectionQuote" => { quote, source },
      _type == "sectionGallery" => {
        title,
        gallery->{ ${galleryCardFragment}, images[]{ _key, ${imageFragment} } },
        images[]{ _key, ${imageFragment} }
      },
      _type == "sectionPeople" => { title, people[]->{ ${personRefFragment}, bio } },
      _type == "sectionChurches" => {
        title,
        "churches": select(
          count(churches) > 0 => churches[]->{ ${churchRefFragment}, kind, dedication, summary, image { ${imageFragment} } },
          *[_type == "church"] | order(order asc){ ${churchRefFragment}, kind, dedication, summary, image { ${imageFragment} } }
        )
      },
      _type == "sectionFaq" => { title, items[]{ _key, question, answer } },
      _type == "sectionDocuments" => {
        title,
        documents[]->{ _id, title, description, category, date, file { asset->{ url, extension, size } } }
      },
      _type == "sectionContact" => { title, showForm },
      _type == "sectionEvents" => { title, limit },
      _type == "sectionMassSchedule" => { title, church->{ _id } },
      _type == "sectionCta" => { title, text, link { ${linkFragment} } }
    },
    ${seoFragment}
  }
`);

// ───────────────────────── Home ─────────────────────────

export const HOME_PAGE_QUERY = defineQuery(/* groq */ `
  *[_type == "homePage" && _id == "homePage"][0]{
    heroImage { ${imageFragment} },
    heroEyebrow,
    heroTitle,
    heroText,
    heroQuote { text, source },
    tile { image { ${imageFragment} }, text, source },
    welcome { title, text, image { ${imageFragment} }, link { ${linkFragment} } },
    featuredLinks[]{ _key, ${linkFragment} },
    ${seoFragment}
  }
`);

// ───────────────────────── Search ─────────────────────────

export const SEARCH_QUERY = defineQuery(/* groq */ `
  *[
    _type in ["announcement", "event", "article", "page", "church", "sacrament", "parishGroup", "gallery", "parishDocument"]
    && (
      title match $term || name match $term || summary match $term || excerpt match $term
      || pt::text(body) match $term || pt::text(description) match $term
    )
  ] | order(_updatedAt desc)[0...40]{
    _id,
    _type,
    "title": coalesce(title, name),
    "slug": slug.current,
    "summary": coalesce(summary, excerpt, select(_type == "parishDocument" => description, pt::text(description)), ""),
    "date": coalesce(start, publishedAt, publishFrom, date, null),
    "fileUrl": file.asset->url
  }
`);

// ───────────────────────── Sitemap ─────────────────────────

export const SITEMAP_QUERY = defineQuery(/* groq */ `
  *[
    _type in ["page", "event", "article", "church", "sacrament", "parishGroup", "gallery", "announcement", "specialPeriod"]
    && defined(slug.current)
    && seo.noIndex != true
  ]{
    _type,
    "slug": slug.current,
    _updatedAt
  }
`);
