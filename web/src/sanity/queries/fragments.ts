/**
 * Reusable GROQ projections. Kept as plain strings so they can be
 * interpolated into `defineQuery` calls (TypeGen still sees the full query).
 */

export const imageFragment = /* groq */ `
  asset->{
    _id,
    url,
    metadata { lqip, dimensions { width, height, aspectRatio } }
  },
  alt,
  caption,
  hotspot,
  crop
`;

export const fileFragment = /* groq */ `
  asset->{ _id, url, originalFilename, extension, size, mimeType }
`;

export const attachmentFragment = /* groq */ `
  _key,
  _type,
  title,
  file { ${fileFragment} }
`;

/** Rich text with images and attachments expanded. */
export const blockContentFragment = /* groq */ `
  ...,
  _type == "imageWithAlt" => { ${imageFragment} },
  _type == "attachment" => { ${attachmentFragment} },
  markDefs[]{ ..., _type == "link" => { href } }
`;

export const churchRefFragment = /* groq */ `
  _id,
  name,
  shortName,
  "slug": slug.current
`;

export const personRefFragment = /* groq */ `
  _id,
  name,
  role,
  roleTitle,
  email,
  phone,
  showContact,
  "slug": slug.current,
  photo { ${imageFragment} }
`;

/** A `link` object resolved to something the frontend can turn into an href. */
export const linkFragment = /* groq */ `
  label,
  kind,
  href,
  internal->{ _type, "slug": slug.current, title, name }
`;

export const pageHeaderFragment = /* groq */ `
  image { ${imageFragment} },
  tagline,
  quote { text, source }
`;

export const seoFragment = /* groq */ `
  "seo": {
    "title": seo.title,
    "description": seo.description,
    "image": seo.image { asset->{ _id, url }, hotspot, crop },
    "noIndex": seo.noIndex == true
  }
`;

export const eventCardFragment = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  start,
  end,
  allDay,
  category,
  summary,
  featured,
  locationName,
  church->{ ${churchRefFragment} },
  image { ${imageFragment} }
`;

export const announcementCardFragment = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  importance,
  category,
  image { ${imageFragment} },
  "hasAttachments": count(attachments) > 0,
  summary,
  publishFrom,
  publishUntil,
  showOnHomepage,
  cta { ${linkFragment} },
  relatedEvent->{ _id, title, "slug": slug.current, start }
`;

export const articleCardFragment = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  image { ${imageFragment} }
`;

export const galleryCardFragment = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  date,
  "count": count(images),
  "cover": coalesce(cover, images[0]) { ${imageFragment} }
`;

export const documentFragment = /* groq */ `
  _id,
  title,
  category,
  date,
  description,
  file { ${fileFragment} }
`;
