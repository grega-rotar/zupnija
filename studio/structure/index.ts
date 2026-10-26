import type {StructureBuilder, StructureResolver} from 'sanity/structure'
import type {ComponentType} from 'react'
import {BellIcon} from '@sanity/icons/Bell'
import {BookIcon} from '@sanity/icons/Book'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {ClockIcon} from '@sanity/icons/Clock'
import {CogIcon} from '@sanity/icons/Cog'
import {DocumentIcon} from '@sanity/icons/Document'
import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {HomeIcon} from '@sanity/icons/Home'
import {ImagesIcon} from '@sanity/icons/Images'
import {SparklesIcon} from '@sanity/icons/Sparkles'
import {StarIcon} from '@sanity/icons/Star'
import {SunIcon} from '@sanity/icons/Sun'
import {UserIcon} from '@sanity/icons/User'
import {UsersIcon} from '@sanity/icons/Users'
import {SINGLETON_TYPES} from '../schemaTypes'

/** Today's date (YYYY-MM-DD) in Ljubljana time, for "upcoming" filters. */
function todayLjubljana(): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Ljubljana'}).format(new Date())
}

function singleton(S: StructureBuilder, type: string, title: string, icon: ComponentType) {
  return S.listItem()
    .title(title)
    .icon(icon)
    .id(type)
    .child(S.document().schemaType(type).documentId(type).title(title))
}

/**
 * Studio navigation written for parish staff: what they think about
 * (Masses, announcements, events …), not what the schema is called.
 */
export const structure: StructureResolver = (S) => {
  const today = todayLjubljana()

  return S.list()
    .title('Župnija Pirniče')
    .items([
      // ───────── DANES / TA TEDEN ─────────
      S.listItem()
        .title('Svete maše in nameni')
        .icon(ClockIcon)
        .id('masses')
        .child(
          S.list()
            .title('Svete maše')
            .items([
              S.listItem()
                .title('Prihajajoči dnevi')
                .icon(SunIcon)
                .id('massDaysUpcoming')
                .child(
                  S.documentTypeList('massDay')
                    .title('Prihajajoči dnevi')
                    .filter('_type == "massDay" && date >= $today')
                    .params({today})
                    .defaultOrdering([{field: 'date', direction: 'asc'}])
                    .initialValueTemplates([S.initialValueTemplateItem('massDay')]),
                ),
              S.listItem()
                .title('Vsi mašni dnevi')
                .icon(CalendarIcon)
                .id('massDaysAll')
                .child(
                  S.documentTypeList('massDay')
                    .title('Vsi mašni dnevi')
                    .defaultOrdering([{field: 'date', direction: 'desc'}]),
                ),
              S.divider(),
              S.listItem()
                .title('Urniki svetih maš')
                .icon(ClockIcon)
                .id('massSchedules')
                .child(S.documentTypeList('massSchedule').title('Urniki svetih maš')),
            ]),
        ),
      S.listItem()
        .title('Oznanila')
        .icon(BellIcon)
        .id('announcements')
        .child(
          S.list()
            .title('Oznanila')
            .items([
              S.listItem()
                .title('Aktualna oznanila')
                .icon(BellIcon)
                .id('announcementsCurrent')
                .child(
                  S.documentTypeList('announcement')
                    .title('Aktualna oznanila')
                    .filter(
                      '_type == "announcement" && (!defined(publishUntil) || publishUntil >= $now)',
                    )
                    .params({now: new Date().toISOString()})
                    .defaultOrdering([{field: 'publishFrom', direction: 'desc'}])
                    .initialValueTemplates([S.initialValueTemplateItem('announcement')]),
                ),
              S.listItem()
                .title('Vsa oznanila (arhiv)')
                .icon(BellIcon)
                .id('announcementsAll')
                .child(
                  S.documentTypeList('announcement')
                    .title('Vsa oznanila')
                    .defaultOrdering([{field: 'publishFrom', direction: 'desc'}]),
                ),
              S.divider(),
              S.listItem()
                .title('Tedenska oznanila')
                .icon(BookIcon)
                .id('weeklyBulletins')
                .child(
                  S.documentTypeList('weeklyBulletin')
                    .title('Tedenska oznanila')
                    .defaultOrdering([{field: 'weekStart', direction: 'desc'}]),
                ),
            ]),
        ),
      S.listItem()
        .title('Dogodki')
        .icon(CalendarIcon)
        .id('events')
        .child(
          S.list()
            .title('Dogodki')
            .items([
              S.listItem()
                .title('Prihajajoči dogodki')
                .icon(CalendarIcon)
                .id('eventsUpcoming')
                .child(
                  S.documentTypeList('event')
                    .title('Prihajajoči dogodki')
                    .filter('_type == "event" && coalesce(end, start) >= $today')
                    .params({today})
                    .defaultOrdering([{field: 'start', direction: 'asc'}])
                    .initialValueTemplates([S.initialValueTemplateItem('event')]),
                ),
              S.listItem()
                .title('Vsi dogodki (arhiv)')
                .icon(CalendarIcon)
                .id('eventsAll')
                .child(
                  S.documentTypeList('event')
                    .title('Vsi dogodki')
                    .defaultOrdering([{field: 'start', direction: 'desc'}]),
                ),
            ]),
        ),
      S.listItem()
        .title('Posebna obdobja')
        .icon(SparklesIcon)
        .id('specialPeriods')
        .child(
          S.documentTypeList('specialPeriod')
            .title('Posebna obdobja')
            .defaultOrdering([{field: 'activeFrom', direction: 'desc'}]),
        ),

      S.divider(),

      // ───────── VSEBINA ─────────
      S.listItem()
        .title('Novice')
        .icon(DocumentTextIcon)
        .id('articles')
        .child(
          S.documentTypeList('article')
            .title('Novice')
            .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
        ),
      S.listItem()
        .title('Galerije')
        .icon(ImagesIcon)
        .id('galleries')
        .child(
          S.documentTypeList('gallery')
            .title('Galerije')
            .defaultOrdering([{field: 'date', direction: 'desc'}]),
        ),
      S.listItem()
        .title('Verouk')
        .icon(BookIcon)
        .id('catechesis')
        .child(
          S.list()
            .title('Verouk')
            .items([
              singleton(S, 'catechesisPage', 'Splošne informacije', BookIcon),
              S.divider(),
              S.listItem()
                .title('Veroučne skupine')
                .icon(UsersIcon)
                .id('catechesisGroups')
                .child(
                  S.documentTypeList('catechesisGroup')
                    .title('Veroučne skupine')
                    .defaultOrdering([
                      {field: 'schoolYear', direction: 'desc'},
                      {field: 'grade', direction: 'asc'},
                    ]),
                ),
            ]),
        ),
      S.listItem()
        .title('Skupine')
        .icon(UsersIcon)
        .id('groups')
        .child(
          S.documentTypeList('parishGroup')
            .title('Skupine')
            .defaultOrdering([{field: 'order', direction: 'asc'}]),
        ),

      S.divider(),

      // ───────── ŽUPNIJA ─────────
      S.listItem()
        .title('Cerkve')
        .icon(HomeIcon)
        .id('churches')
        .child(
          S.documentTypeList('church').title('Cerkve').defaultOrdering([{field: 'order', direction: 'asc'}]),
        ),
      S.listItem()
        .title('Duhovniki in sodelavci')
        .icon(UserIcon)
        .id('people')
        .child(
          S.documentTypeList('person')
            .title('Duhovniki in sodelavci')
            .defaultOrdering([{field: 'order', direction: 'asc'}]),
        ),
      S.listItem()
        .title('Zakramenti')
        .icon(StarIcon)
        .id('sacraments')
        .child(
          S.documentTypeList('sacrament')
            .title('Zakramenti')
            .defaultOrdering([{field: 'order', direction: 'asc'}]),
        ),
      S.listItem()
        .title('Dokumenti')
        .icon(DocumentIcon)
        .id('documents')
        .child(
          S.documentTypeList('parishDocument')
            .title('Dokumenti')
            .defaultOrdering([{field: 'date', direction: 'desc'}]),
        ),

      S.divider(),

      // ───────── SPLETNA STRAN ─────────
      singleton(S, 'homePage', 'Domača stran', HomeIcon),
      S.listItem()
        .title('Strani')
        .icon(DocumentIcon)
        .id('pages')
        .child(S.documentTypeList('page').title('Strani')),
      singleton(S, 'settings', 'Nastavitve župnije', CogIcon),

      // Anything not explicitly placed above (should be nothing) — keeps
      // future types reachable without editing this file.
      ...S.documentTypeListItems().filter((item) => {
        const id = item.getId() as string
        const placed = [
          ...SINGLETON_TYPES,
          'massDay',
          'massSchedule',
          'announcement',
          'weeklyBulletin',
          'event',
          'specialPeriod',
          'article',
          'gallery',
          'catechesisGroup',
          'parishGroup',
          'church',
          'person',
          'sacrament',
          'parishDocument',
          'page',
        ]
        return !placed.includes(id)
      }),
    ])
}
