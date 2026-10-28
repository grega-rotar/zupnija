import { defineQuery } from "./define";
import { churchRefFragment, imageFragment, personRefFragment } from "./fragments";

/**
 * Recurring schedules that could apply to any day in [$from, $to].
 * Schedules without dates are the regular schedule.
 */
export const MASS_SCHEDULES_QUERY = defineQuery(/* groq */ `
  *[
    _type == "massSchedule"
    && (!defined(validFrom) || validFrom <= $to)
    && (!defined(validUntil) || validUntil >= $from)
  ]{
    _id,
    title,
    validFrom,
    validUntil,
    replacesRegular,
    note,
    entries[]{
      _key,
      weekdays,
      time,
      type,
      note,
      church->{ ${churchRefFragment} }
    }
  }
`);

/** Explicit Mass days (intentions, extra Masses, cancellations) in a range. */
export const MASS_DAYS_QUERY = defineQuery(/* groq */ `
  *[_type == "massDay" && date >= $from && date <= $to] | order(date asc){
    _id,
    date,
    liturgicalTitle,
    replacesSchedule,
    note,
    masses[]{
      _key,
      time,
      type,
      status,
      statusNote,
      note,
      church->{ ${churchRefFragment} },
      celebrant->{ ${personRefFragment} },
      intentions[]{ _key, kind, text }
    }
  }
`);

/** The regular (undated) schedule plus any schedule valid today — for the schedule page. */
export const CURRENT_SCHEDULES_QUERY = defineQuery(/* groq */ `
  *[
    _type == "massSchedule"
    && (
      (!defined(validFrom) && !defined(validUntil))
      || ((!defined(validFrom) || validFrom <= $today) && (!defined(validUntil) || validUntil >= $today))
      || (defined(validFrom) && validFrom > $today && validFrom <= $horizon)
    )
  ] | order(validFrom asc){
    _id,
    title,
    validFrom,
    validUntil,
    replacesRegular,
    note,
    entries[]{
      _key,
      weekdays,
      time,
      type,
      note,
      church->{ ${churchRefFragment} }
    }
  }
`);

/** Churches listed on the Mass pages. */
export const CHURCHES_BRIEF_QUERY = defineQuery(/* groq */ `
  *[_type == "church"] | order(order asc, name asc){
    ${churchRefFragment},
    kind,
    address,
    image { ${imageFragment} }
  }
`);
