/**
 * Writes the VERIFIED basic parish information: settings, the pastor, the
 * three churches, the regular Mass schedule, Karitas, and the Mass days with
 * intentions for the rest of the current bulletin.
 *
 *   npx sanity exec scripts/seed-parish-data.ts --with-user-token
 *
 * Run `seed-sample-content.ts -- --clean` first, otherwise the sample
 * churches and the sample schedule show up next to the real ones.
 *
 * Sources (checked 2026-10-26):
 * - Oznanila župnije Pirniče, oktober 2026 (https://www.pirnice.si/download_file/view/1161/489)
 * - https://pirnice.si/zupnija-pirnice/osnovni-podatki
 * - https://pirnice.si/zupnija-pirnice (history)
 * - https://pirnice.si/zupnija-pirnice/karitas
 * - https://sl.wikipedia.org/wiki/Župnija_Pirniče (deanery, churches)
 *
 * Only `settings` fields listed below are overwritten; everything else in the
 * singleton (siteUrl, contact form recipient, headers …) is left as it is.
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-09-14', perspective: 'raw'})

let keyCounter = 0
const key = () => `k${(keyCounter++).toString(36)}${Date.now().toString(36).slice(-3)}`

function block(text: string, style: 'normal' | 'h2' = 'normal') {
  return {_type: 'block', _key: key(), style, markDefs: [], children: [{_type: 'span', _key: key(), text, marks: []}]}
}

const ref = (id: string) => ({_type: 'reference', _ref: id})
const slug = (current: string) => ({_type: 'slug', current})

const ID = {
  pastor: 'person-blaz-jezersek',
  churchMarija: 'church-marijino-vnebovzetje',
  churchKriz: 'church-sv-kriz',
  churchTomaz: 'church-sv-tomaz',
  scheduleRegular: 'schedule-redni',
  groupKaritas: 'group-karitas',
}

const PHONE = '01 362 11 71'
const MOBILE = '041 604 422'
const EMAIL = 'zupirnice@gmail.com'

const docs: Record<string, unknown>[] = []

docs.push({
  _id: ID.pastor,
  _type: 'person',
  name: 'msgr. dr. Blaž Jezeršek',
  slug: slug('blaz-jezersek'),
  role: 'pastor',
  phone: MOBILE,
  email: EMAIL,
  showContact: true,
  order: 1,
})

docs.push(
  {
    _id: ID.churchMarija,
    _type: 'church',
    name: 'Župnijska cerkev Marijinega vnebovzetja',
    shortName: 'Marijina cerkev',
    slug: slug('marijino-vnebovzetje'),
    kind: 'parish',
    dedication: 'Marijino vnebovzetje',
    patronFeast: '15. avgust',
    order: 1,
    summary: 'Župnijska cerkev v Zgornjih Pirničah, zgrajena po ustanovitvi župnije leta 1985.',
    history: [
      block(
        'Župnija Pirniče je bila ustanovljena leta 1985 na praznik Marijinega vnebovzetja, ko se je izločila iz župnije Smlednik. Obsega vasi Verje, Zgornje Pirniče, Spodnje Pirniče, Vikrče in Zavrh pod Šmarno goro.',
      ),
      block('Prvi župnik Peter Slevec je vodil gradnjo Marijine cerkve, ki je postala središče župnije.'),
    ],
    address: {_type: 'address', street: 'Zgornje Pirniče 74b', postalCode: '1215', city: 'Medvode'},
  },
  {
    _id: ID.churchKriz,
    _type: 'church',
    name: 'Podružnična cerkev Povišanja svetega Križa',
    shortName: 'Sv. Križ',
    slug: slug('sv-kriz'),
    kind: 'filial',
    dedication: 'Povišanje svetega Križa',
    patronFeast: '14. september',
    order: 2,
    summary: 'Podružnična cerkev v Spodnjih Pirničah.',
    address: {_type: 'address', street: 'Spodnje Pirniče', postalCode: '1215', city: 'Medvode'},
  },
  {
    _id: ID.churchTomaz,
    _type: 'church',
    name: 'Podružnična cerkev sv. Tomaža, apostola',
    shortName: 'Sv. Tomaž',
    slug: slug('sv-tomaz'),
    kind: 'filial',
    dedication: 'Sv. Tomaž, apostol',
    patronFeast: '3. julij',
    order: 3,
    summary: 'Podružnična cerkev v Zgornjih Pirničah.',
    address: {_type: 'address', street: 'Zgornje Pirniče', postalCode: '1215', city: 'Medvode'},
  },
)

const entry = (weekdays: string[], time: string, church: string, type = 'regular', note?: string) => ({
  _type: 'massScheduleEntry',
  _key: key(),
  weekdays,
  time,
  church: ref(church),
  type,
  ...(note ? {note} : {}),
})

docs.push({
  _id: ID.scheduleRegular,
  _type: 'massSchedule',
  title: 'Redni urnik',
  entries: [
    entry(['sunday'], '08:00', ID.churchKriz, 'sunday'),
    entry(['sunday'], '10:00', ID.churchMarija, 'sunday'),
    entry(['saturday'], '18:30', ID.churchMarija, 'sunday', 'nedeljska maša v soboto zvečer'),
    entry(['monday', 'friday'], '18:30', ID.churchKriz),
    entry(['tuesday', 'wednesday'], '18:30', ID.churchMarija),
    entry(['thursday'], '07:00', ID.churchMarija),
  ],
  note: [block('Za krst, poroko in spoved se oglasite pri župniku, kjer se boste dogovorili za pripravo in podelitev zakramenta.')],
})

docs.push({
  _id: ID.groupKaritas,
  _type: 'parishGroup',
  title: 'Župnijska Karitas Pirniče',
  slug: slug('zupnijska-karitas'),
  summary: 'Sodelavci Župnijske Karitas Pirniče s skupnimi močmi udejanjamo ljubezen do bližnjega.',
  description: [
    block('Župnijska Karitas Pirniče je bila ustanovljena z namenom, da konkretizira krščansko ljubezen.'),
    block('Dar za Karitas: SI56 0202 1025 3468 769.'),
  ],
  meetingSchedule: 'Uradne ure vsak 1. ponedeljek v mesecu od 17. do 18. ure',
  location: 'Mežnarija v Spodnjih Pirničah',
  contactName: 'Jera Rak',
  email: 'karitas.pirnice@gmail.com',
  phone: '031 422 688',
  order: 1,
})

// Mass days with intentions, from the October 2026 bulletin (still upcoming on 2026-10-26).
const intent = (kind: string, text: string) => ({_type: 'massIntention', _key: key(), kind, text})
const massDay = (date: string, time: string, church: string, intentions: ReturnType<typeof intent>[], type = 'regular') => ({
  _id: `massday-${date}`,
  _type: 'massDay',
  date,
  replacesSchedule: false,
  masses: [{_type: 'massOccurrence', _key: key(), time, church: ref(church), type, status: 'scheduled', intentions}],
})
docs.push(
  massDay('2026-10-26', '18:30', ID.churchKriz, [intent('deceased', 'iz družin Pretnar in Jesihar')]),
  massDay('2026-10-27', '18:30', ID.churchMarija, [intent('deceased', 'Štefan Hrovat')]),
  massDay('2026-10-28', '18:30', ID.churchMarija, [intent('deceased', 'Branko Babnik')]),
  massDay('2026-10-29', '07:00', ID.churchMarija, [intent('thanksgiving', 'v zahvalo')]),
  massDay('2026-10-30', '18:30', ID.churchKriz, [intent('other', 'na čast Svetemu Duhu')]),
  massDay('2026-10-31', '18:30', ID.churchMarija, [intent('deceased', 'iz družin Bezlaj in Jamnik')], 'sunday'),
)

const hours = (weekday: string, from: string, to: string) => ({_type: 'openingHours', _key: key(), weekday, from, to})

async function run() {
  const tx = client.transaction()
  for (const doc of docs) tx.createOrReplace(doc as {_id: string; _type: string})
  tx.createIfNotExists({_id: 'settings', _type: 'settings', name: 'Župnija Pirniče'})
  tx.patch('settings', (p) =>
    p.set({
      name: 'Župnija Pirniče',
      diocese: 'Nadškofija Ljubljana, dekanija Ljubljana - Šentvid',
      pastor: ref(ID.pastor),
      address: {_type: 'address', street: 'Zgornje Pirniče 74b', postalCode: '1215', city: 'Medvode'},
      phone: PHONE,
      mobile: MOBILE,
      email: EMAIL,
      officeHours: [
        hours('monday', '17:00', '18:00'),
        hours('tuesday', '11:00', '12:00'),
        hours('thursday', '07:30', '08:00'),
        hours('friday', '17:00', '18:00'),
      ],
      officeHoursNote: [block('Za krst, poroko in spoved se oglasite pri župniku, kjer se boste dogovorili za pripravo in podelitev zakramenta.')],
      emergencyContact: {label: 'Za bolniško maziljenje in pogreb', phone: MOBILE},
      donations: {
        recipient: 'Župnija Pirniče',
        iban: 'SI56 0202 1026 2993 393',
        purpose: 'Dar za župnijo',
      },
      socialLinks: [{_type: 'socialLink', _key: key(), platform: 'facebook', url: 'https://www.facebook.com/ZUPirnice'}],
      seo: {_type: 'seo', description: 'Svete maše, oznanila, dogodki in verouk v župniji Pirniče pod Šmarno goro.'},
    }),
  )
  tx.patch('settings', (p) => p.unset(['tagline', 'footerText']))
  await tx.commit()
  console.log(`Zapisanih ${docs.length} dokumentov in nastavitve župnije.`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
