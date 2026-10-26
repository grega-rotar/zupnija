/**
 * Seeds the dataset with clearly marked SAMPLE content so the website can be
 * designed, tested and demonstrated before the parish enters real data.
 *
 *   npx sanity exec scripts/seed-sample-content.ts --with-user-token
 *   npx sanity exec scripts/seed-sample-content.ts --with-user-token -- --clean
 *
 * Every sample document has an id starting with `sample-` so it can be
 * removed at once (`--clean`). (Ids must not contain a dot: dotted ids are
 * private to authenticated requests and invisible to the public website.) Singletons (settings, homePage,
 * catechesisPage) are written with their fixed ids and are NOT removed by
 * `--clean`; edit them in the Studio instead.
 *
 * Nothing here is verified parish information. Names, phone numbers,
 * addresses and times are placeholders and say so where visitors could
 * mistake them for facts.
 */
import {getCliClient} from 'sanity/cli'
import {placeholderPdf, placeholderPng} from './lib/placeholder-image'

const client = getCliClient({apiVersion: '2026-09-14', perspective: 'raw'})
const clean = process.argv.includes('--clean')

// ───────────────────────── helpers ─────────────────────────

let keyCounter = 0
const key = () => `k${(keyCounter++).toString(36)}${Date.now().toString(36).slice(-3)}`

function span(text: string, marks: string[] = []) {
  return {_type: 'span', _key: key(), text, marks}
}

function block(text: string, style: 'normal' | 'h2' | 'h3' | 'blockquote' = 'normal') {
  return {_type: 'block', _key: key(), style, markDefs: [], children: [span(text)]}
}

function bullets(items: string[]) {
  return items.map((text) => ({
    _type: 'block',
    _key: key(),
    style: 'normal',
    listItem: 'bullet',
    level: 1,
    markDefs: [],
    children: [span(text)],
  }))
}

const ref = (id: string) => ({_type: 'reference', _ref: id})
const slug = (current: string) => ({_type: 'slug', current})

/** Today in Ljubljana, YYYY-MM-DD. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Ljubljana'}).format(new Date())
}
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function weekday(date: string): string {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    new Date(`${date}T12:00:00Z`).getUTCDay()
  ]
}
/** Local Ljubljana time → ISO string (approximate: uses fixed +02:00/+01:00 by month). */
function at(date: string, time: string): string {
  const month = Number(date.slice(5, 7))
  const offset = month >= 4 && month <= 10 ? '+02:00' : '+01:00'
  return new Date(`${date}T${time}:00${offset}`).toISOString()
}

const T = today()
const sunday = addDays(T, -new Date(`${T}T12:00:00Z`).getUTCDay())

const uploadedImages = new Map<number, string>()
async function image(seed: number, alt: string, caption?: string) {
  let assetId = uploadedImages.get(seed)
  if (!assetId) {
    const asset = await client.assets.upload('image', placeholderPng(1600, 1067, seed), {
      filename: `vzorec-${seed}.png`,
      title: `Vzorčna slika ${seed}`,
    })
    assetId = asset._id
    uploadedImages.set(seed, assetId)
    console.log('  slika', seed)
  }
  return {_type: 'imageWithAlt', _key: key(), asset: ref(assetId), alt, ...(caption ? {caption} : {})}
}

async function pdf(title: string) {
  const asset = await client.assets.upload('file', placeholderPdf(title), {
    filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
    contentType: 'application/pdf',
  })
  return {_type: 'file', asset: ref(asset._id)}
}

// ───────────────────────── ids ─────────────────────────

const ID = {
  churchKriz: 'sample-church-sv-kriz',
  churchMarija: 'sample-church-marijino-vnebovzetje',
  pastor: 'sample-person-zupnik',
  catechist1: 'sample-person-katehistinja',
  organist: 'sample-person-organist',
  scheduleRegular: 'sample-schedule-redni',
  scheduleFeast: 'sample-schedule-zegnanje',
  groupChoir: 'sample-group-zbor',
  groupMinistranti: 'sample-group-ministranti',
  groupKaritas: 'sample-group-karitas',
  groupMladi: 'sample-group-mladi',
  eventZegnanje: 'sample-event-zegnanje',
  eventRomanje: 'sample-event-romanje',
  eventVerouk: 'sample-event-zacetek-verouka',
  eventKoncert: 'sample-event-koncert',
  eventPast: 'sample-event-oratorij',
  docPrijavnica: 'sample-doc-prijavnica-verouk',
  docKrst: 'sample-doc-prijava-krsta',
  gallery1: 'sample-gallery-oratorij',
  pageAbout: 'sample-page-o-zupniji',
  pagePrivacy: 'sample-page-zasebnost',
  period: 'sample-period-zegnanje',
  annImportant: 'sample-ann-verouk',
  annRomanje: 'sample-ann-romanje',
  annCiscenje: 'sample-ann-ciscenje',
}

// ───────────────────────── main ─────────────────────────

async function removeSamples() {
  const ids: string[] = await client.fetch(
    `*[
      string::startsWith(_id, "sample-") || string::startsWith(_id, "drafts.sample-")
      || _id in path("sample.**") || _id in path("drafts.sample.**")
    ]._id`,
  )
  if (!ids.length) {
    console.log('Ni vzorčnih dokumentov.')
    return
  }
  const tx = client.transaction()
  // Singletons keep referencing sample documents; clear those fields first.
  tx.patch('settings', (p) => p.unset(['pastor', 'privacyPage', 'legalPage']))
  tx.patch('homePage', (p) => p.unset(['featuredLinks', 'welcome.link']))
  tx.patch('catechesisPage', (p) => p.unset(['contact', 'documents']))
  ids.forEach((id) => tx.delete(id))
  await tx.commit()
  console.log(`Odstranjenih ${ids.length} vzorčnih dokumentov.`)
}

async function seed() {
  console.log('Nalagam vzorčne slike …')
  const heroImg = await image(1, 'Vzorčna slika: polja in cerkev pod Šmarno goro')
  const krizImg = await image(2, 'Vzorčna slika: župnijska cerkev sv. Križa')
  const marijaImg = await image(3, 'Vzorčna slika: podružnična cerkev')
  const pastorImg = await image(4, 'Vzorčna slika: portret')
  const periodImg = await image(5, 'Vzorčna slika: praznično okrašen oltar')
  const eventImg = await image(6, 'Vzorčna slika: romarska pot')
  const article1Img = await image(7, 'Vzorčna slika: oratorij na župnijskem dvorišču')
  const article2Img = await image(8, 'Vzorčna slika: obnovljena streha')
  const galleryImgs = await Promise.all(
    [11, 12, 13, 14, 15, 16].map((s, i) => image(s, `Vzorčna fotografija ${i + 1}`)),
  )
  const groupImg = await image(9, 'Vzorčna slika: pevski zbor')
  const sacramentImg = await image(10, 'Vzorčna slika: krstilnik')

  console.log('Nalagam vzorčne dokumente (PDF) …')
  const prijavnicaFile = await pdf('Prijavnica za verouk (vzorec)')
  const krstFile = await pdf('Prijava krsta (vzorec)')

  const docs: Record<string, unknown>[] = []

  // People
  docs.push(
    {
      _id: ID.pastor,
      _type: 'person',
      name: 'Janez Vzorčnik',
      slug: slug('janez-vzorcnik'),
      role: 'pastor',
      photo: pastorImg,
      bio: [block('Vzorčna predstavitev. Župnik skrbi za župnijo od leta 2020. To besedilo nadomestite z resničnim.')],
      email: 'zupnik@example.si',
      phone: '041 000 000',
      showContact: true,
      order: 1,
    },
    {
      _id: ID.catechist1,
      _type: 'person',
      name: 'Marija Vzorčna',
      slug: slug('marija-vzorcna'),
      role: 'catechist',
      bio: [block('Vzorčna oseba: katehistinja za nižje razrede.')],
      showContact: false,
      order: 10,
    },
    {
      _id: ID.organist,
      _type: 'person',
      name: 'Peter Vzorčnik',
      slug: slug('peter-vzorcnik'),
      role: 'pastoral',
      roleTitle: 'organist in zborovodja',
      showContact: false,
      order: 11,
    },
  )

  // Churches
  docs.push(
    {
      _id: ID.churchKriz,
      _type: 'church',
      name: 'Župnijska cerkev sv. Križa',
      shortName: 'Sv. Križ',
      slug: slug('sv-kriz'),
      kind: 'parish',
      dedication: 'Povišanje sv. Križa',
      patronFeast: '14. september',
      order: 1,
      summary: 'Vzorčni opis. Župnijska cerkev v Zgornjih Pirničah — nadomestite z resničnim opisom in fotografijo.',
      description: [
        block('To je vzorčno besedilo. Opišite cerkev: kdaj je bila zgrajena, komu je posvečena, kaj je v njej vredno ogleda.'),
        block('Oltarji, freske, orgle in zvonovi si zaslužijo kratek, prijazen opis, ki ga razume vsak obiskovalec.'),
      ],
      history: [block('Vzorčna zgodovina. Tu bo kratek zgodovinski oris cerkve in župnije.')],
      address: {_type: 'address', street: 'Zgornje Pirniče 1 (vzorec)', postalCode: '1215', city: 'Medvode'},
      accessibility: [block('Vzorec: vhod brez stopnic s strani zakristije. Indukcijska zanka ni na voljo.')],
      parking: [block('Vzorec: parkiranje ob cerkvi in pri župnišču; ob nedeljah tudi pri šoli.')],
      visitNotes: [block('Vzorec: cerkev je odprta v času bogoslužja; za ogled se dogovorite v župnišču.')],
      image: krizImg,
      gallery: galleryImgs.slice(0, 3).map((img) => ({...img, _key: key()})),
    },
    {
      _id: ID.churchMarija,
      _type: 'church',
      name: 'Podružnična cerkev Marijinega vnebovzetja',
      shortName: 'Marijino vnebovzetje',
      slug: slug('marijino-vnebovzetje'),
      kind: 'filial',
      dedication: 'Marijino vnebovzetje',
      patronFeast: '15. avgust',
      order: 2,
      summary: 'Vzorčni opis podružnične cerkve. Nadomestite z resničnimi podatki.',
      description: [block('Vzorčno besedilo o podružnični cerkvi.')],
      address: {_type: 'address', street: 'Spodnje Pirniče 1 (vzorec)', postalCode: '1215', city: 'Medvode'},
      parking: [block('Vzorec: nekaj parkirnih mest ob cesti.')],
      image: marijaImg,
    },
  )

  // Schedules
  const entry = (weekdays: string[], time: string, church: string, type = 'regular', note?: string) => ({
    _type: 'massScheduleEntry',
    _key: key(),
    weekdays,
    time,
    church: ref(church),
    type,
    ...(note ? {note} : {}),
  })
  docs.push(
    {
      _id: ID.scheduleRegular,
      _type: 'massSchedule',
      title: 'Redni urnik',
      entries: [
        entry(['sunday'], '08:00', ID.churchKriz, 'sunday'),
        entry(['sunday'], '10:00', ID.churchMarija, 'sunday'),
        entry(['monday', 'wednesday', 'friday'], '19:00', ID.churchKriz),
        entry(['tuesday', 'thursday'], '07:30', ID.churchKriz),
        entry(['saturday'], '19:00', ID.churchMarija, 'regular', 'nedeljska maša v soboto zvečer'),
      ],
      note: [block('Vzorčni urnik. Spoved je mogoča pol ure pred vsako sveto mašo.')],
    },
    {
      _id: ID.scheduleFeast,
      _type: 'massSchedule',
      title: 'Farno žegnanje (vzorec)',
      validFrom: addDays(T, -1),
      validUntil: addDays(T, 1),
      replacesRegular: false,
      entries: [entry([weekday(T)], '18:00', ID.churchKriz, 'feast', 'slovesna maša z gostom')],
    },
  )

  // Mass days with intentions: this week + next
  const intent = (kind: string, text: string) => ({_type: 'massIntention', _key: key(), kind, text})
  type Occurrence = Record<string, unknown> & {_key: string; intentions: ReturnType<typeof intent>[]}
  const occ = (time: string, church: string, intentions: ReturnType<typeof intent>[], extra: Record<string, unknown> = {}): Occurrence => ({
    _type: 'massOccurrence',
    _key: key(),
    time,
    church: ref(church),
    type: 'regular',
    status: 'scheduled',
    intentions,
    ...extra,
  })
  const names = ['Jože Novak, obl.', 'starši Kovač', 'Ana Vzorčna in sorodniki', 'Franc in Marija Zupan', 'Terezija Kos, 30. dan', 'pokojni iz družine Mlakar']
  let n = 0
  const nextName = () => names[n++ % names.length]
  for (let i = 0; i < 14; i++) {
    const date = addDays(sunday, i)
    const wd = weekday(date)
    const masses: Occurrence[] = []
    if (wd === 'sunday') {
      masses.push(
        occ('08:00', ID.churchKriz, [intent('parish', 'za žive in rajne župljane'), intent('deceased', nextName())]),
        occ('10:00', ID.churchMarija, [intent('deceased', nextName()), intent('thanksgiving', 'v zahvalo za 50 let zakona')]),
      )
    } else if (wd === 'saturday') {
      masses.push(occ('19:00', ID.churchMarija, [intent('deceased', nextName())]))
    } else if (wd === 'tuesday' || wd === 'thursday') {
      masses.push(occ('07:30', ID.churchKriz, [intent('deceased', nextName())]))
    } else {
      masses.push(occ('19:00', ID.churchKriz, [intent('deceased', nextName()), intent('health', 'za zdravje v družini')]))
    }
    const extra: Record<string, unknown> = {}
    if (i === 3) {
      // a cancelled weekday Mass, to show the state
      masses[0] = {...masses[0], status: 'cancelled', statusNote: 'zaradi dekanijskega srečanja duhovnikov', intentions: []}
      extra.note = [block('Vzorec: sveta maša ta dan odpade; nameni so preneseni na naslednji dan.')]
    }
    if (date === T) {
      masses.push(
        occ('18:00', ID.churchKriz, [intent('parish', 'za župnijo in dobrotnike')], {
          type: 'feast',
          note: 'po maši druženje pred cerkvijo',
          celebrant: ref(ID.pastor),
        }),
      )
      extra.liturgicalTitle = 'Povišanje sv. Križa — farno žegnanje (vzorec)'
    } else if (wd === 'sunday') {
      extra.liturgicalTitle = `${i === 0 ? '24.' : '25.'} nedelja med letom (vzorec)`
    }
    docs.push({
      _id: `sample-massday-${date}`,
      _type: 'massDay',
      date,
      masses,
      replacesSchedule: false,
      ...extra,
    })
  }

  // Groups
  docs.push(
    {
      _id: ID.groupChoir,
      _type: 'parishGroup',
      title: 'Mešani pevski zbor',
      slug: slug('mesani-pevski-zbor'),
      summary: 'Vzorec: poje pri nedeljskih in prazničnih mašah. Novi pevci so vedno dobrodošli.',
      description: [block('Vzorčna predstavitev zbora. Vaje so enkrat tedensko, petje pri maši ob nedeljah.')],
      meetingSchedule: 'Vaje ob četrtkih ob 19.30',
      location: 'Župnišče, zgornja dvorana',
      contactPerson: ref(ID.organist),
      image: groupImg,
      order: 1,
    },
    {
      _id: ID.groupMinistranti,
      _type: 'parishGroup',
      title: 'Ministranti',
      slug: slug('ministranti'),
      summary: 'Vzorec: fantje in dekleta, ki strežejo pri oltarju. Vabljeni od prvega obhajila naprej.',
      description: [block('Vzorčna predstavitev ministrantov.')],
      meetingSchedule: 'Srečanja ob sobotah ob 10.00',
      location: 'Cerkev sv. Križa',
      contactPerson: ref(ID.pastor),
      order: 2,
    },
    {
      _id: ID.groupKaritas,
      _type: 'parishGroup',
      title: 'Župnijska Karitas',
      slug: slug('zupnijska-karitas'),
      summary: 'Vzorec: pomoč družinam in starejšim v stiski, obiski bolnih, zbiranje oblačil.',
      description: [block('Vzorčna predstavitev Karitas.')],
      meetingSchedule: 'Uradne ure vsak prvi torek v mesecu, 17.00–18.00',
      location: 'Župnišče',
      contactName: 'Vzorčna kontaktna oseba',
      phone: '031 000 000',
      order: 3,
    },
    {
      _id: ID.groupMladi,
      _type: 'parishGroup',
      title: 'Mladinska skupina',
      slug: slug('mladinska-skupina'),
      summary: 'Vzorec: srečanja mladih po birmi — pogovor, molitev, izleti in oratorij.',
      description: [block('Vzorčna predstavitev mladinske skupine.')],
      meetingSchedule: 'Ob petkih ob 20.00',
      location: 'Župnišče',
      order: 4,
    },
  )

  // Documents
  docs.push(
    {
      _id: ID.docPrijavnica,
      _type: 'parishDocument',
      title: 'Prijavnica za verouk (vzorec)',
      file: prijavnicaFile,
      category: 'catechesis',
      date: T,
      description: 'Vzorčni dokument. Izpolnjeno prijavnico oddajte v župnišču.',
      public: true,
    },
    {
      _id: ID.docKrst,
      _type: 'parishDocument',
      title: 'Prijava krsta (vzorec)',
      file: krstFile,
      category: 'forms',
      date: T,
      description: 'Vzorčni obrazec za prijavo krsta.',
      public: true,
    },
  )

  // Events
  docs.push(
    {
      _id: ID.eventZegnanje,
      _type: 'event',
      title: 'Farno žegnanje — slovesna sveta maša',
      slug: slug('farno-zegnanje'),
      start: at(T, '18:00'),
      end: at(T, '19:30'),
      church: ref(ID.churchKriz),
      category: 'feast',
      summary: 'Vzorec: slovesna sveta maša ob prazniku Povišanja sv. Križa, po maši druženje pred cerkvijo.',
      description: [block('Vzorčni opis dogodka.'), block('Vabljeni vsi župljani in prijatelji župnije.')],
      featured: true,
      image: periodImg,
    },
    {
      _id: ID.eventVerouk,
      _type: 'event',
      title: 'Začetek verouka in blagoslov šolskih torb',
      slug: slug('zacetek-verouka'),
      start: at(addDays(T, 6), '10:00'),
      church: ref(ID.churchKriz),
      category: 'catechesis',
      summary: 'Vzorec: sveta maša za začetek veroučnega leta. Otroci naj prinesejo šolske torbe.',
      description: [block('Vzorčni opis.')],
      organizer: ref(ID.groupMinistranti),
    },
    {
      _id: ID.eventRomanje,
      _type: 'event',
      title: 'Župnijsko romanje na Brezje',
      slug: slug('zupnijsko-romanje-brezje'),
      start: at(addDays(T, 19), '07:00'),
      end: at(addDays(T, 19), '18:00'),
      allDay: false,
      locationName: 'Brezje (odhod avtobusa izpred župnišča)',
      category: 'pilgrimage',
      summary: 'Vzorec: celodnevno romanje z avtobusom. Prijave v župnišču do konca meseca.',
      description: [block('Vzorčni opis romanja.'), block('Cena vključuje prevoz in kosilo. Prijave sprejemamo v župnišču.')],
      registration: {_type: 'link', label: 'Prijava na romanje', kind: 'external', href: 'https://example.si/prijava'},
      image: eventImg,
    },
    {
      _id: ID.eventKoncert,
      _type: 'event',
      title: 'Koncert cerkvenih zborov',
      slug: slug('koncert-cerkvenih-zborov'),
      start: at(addDays(T, 33), '19:00'),
      church: ref(ID.churchMarija),
      category: 'culture',
      summary: 'Vzorec: srečanje pevskih zborov dekanije.',
      organizer: ref(ID.groupChoir),
    },
    {
      _id: ID.eventPast,
      _type: 'event',
      title: 'Oratorij 2026',
      slug: slug('oratorij-2026'),
      start: at(addDays(T, -60), '08:00'),
      end: at(addDays(T, -56), '16:00'),
      allDay: true,
      locationName: 'Župnišče in dvorišče',
      category: 'youth',
      summary: 'Vzorec: pretekli dogodek — poletni oratorij za otroke.',
      organizer: ref(ID.groupMladi),
    },
  )

  // Gallery
  docs.push({
    _id: ID.gallery1,
    _type: 'gallery',
    title: 'Oratorij 2026 (vzorec)',
    slug: slug('oratorij-2026'),
    date: addDays(T, -56),
    description: [block('Vzorčne fotografije — nadomestite z resničnimi.')],
    images: galleryImgs.map((img) => ({...img, _key: key()})),
    relatedEvent: ref(ID.eventPast),
    photographer: 'Vzorčni fotograf',
  })

  // Articles
  docs.push(
    {
      _id: 'sample-article-oratorij',
      _type: 'article',
      title: 'Oratorij je povezal več kot sto otrok',
      slug: slug('oratorij-povezal-otroke'),
      excerpt: 'Vzorčna novica. En teden iger, kateheze in prijateljstva na župnijskem dvorišču.',
      image: article1Img,
      body: [
        block('To je vzorčno besedilo novice. Nadomestite ga z resničnim poročilom.'),
        block('Zahvala', 'h2'),
        block('Hvala animatorjem, staršem in vsem, ki so pomagali.'),
      ],
      publishedAt: at(addDays(T, -50), '12:00'),
      author: ref(ID.pastor),
      gallery: ref(ID.gallery1),
      relatedEvent: ref(ID.eventPast),
    },
    {
      _id: 'sample-article-streha',
      _type: 'article',
      title: 'Obnova strehe na podružnični cerkvi je končana',
      slug: slug('obnova-strehe-koncana'),
      excerpt: 'Vzorčna novica o zaključenih delih in zahvala darovalcem.',
      image: article2Img,
      body: [block('Vzorčno besedilo.'), block('Skupni stroški in način zbiranja sredstev bodo predstavljeni na sestanku ŽPS.')],
      publishedAt: at(addDays(T, -12), '12:00'),
    },
  )

  // Announcements
  docs.push(
    {
      _id: ID.annImportant,
      _type: 'announcement',
      title: 'Vpis k verouku za šolsko leto 2026/2027',
      slug: slug('vpis-k-verouku-2026-2027'),
      importance: 'important',
      summary: 'Vzorec: vpis poteka v času uradnih ur do konca meseca. Prijavnica je na voljo na spletni strani.',
      body: [block('Vzorčno besedilo oznanila.')],
      publishFrom: at(addDays(T, -3), '08:00'),
      publishUntil: at(addDays(T, 20), '23:45'),
      showOnHomepage: true,
      cta: {_type: 'link', label: 'Prijavnica za verouk', kind: 'internal', internal: ref(ID.docPrijavnica)},
      attachments: [{_type: 'attachment', _key: key(), title: 'Prijavnica (PDF)', file: prijavnicaFile}],
    },
    {
      _id: ID.annRomanje,
      _type: 'announcement',
      title: 'Prijave za župnijsko romanje',
      slug: slug('prijave-za-romanje'),
      importance: 'normal',
      summary: 'Vzorec: prijave sprejemamo v župnišču. Število mest je omejeno.',
      publishFrom: at(addDays(T, -1), '08:00'),
      publishUntil: at(addDays(T, 18), '23:45'),
      showOnHomepage: true,
      relatedEvent: ref(ID.eventRomanje),
    },
    {
      _id: ID.annCiscenje,
      _type: 'announcement',
      title: 'Čiščenje cerkve ta teden',
      slug: slug('ciscenje-cerkve'),
      importance: 'normal',
      summary: 'Vzorec: ta teden čistijo in krasijo cerkev vaščani Zgornjih Pirnič. Hvala!',
      publishFrom: at(sunday, '08:00'),
      publishUntil: at(addDays(sunday, 6), '23:45'),
      showOnHomepage: false,
    },
    {
      _id: 'sample-ann-expired',
      _type: 'announcement',
      title: 'Poletni urnik svetih maš (poteklo)',
      slug: slug('poletni-urnik-2026'),
      importance: 'normal',
      summary: 'Vzorec poteklega oznanila — prikazano samo v arhivu.',
      publishFrom: at(addDays(T, -90), '08:00'),
      publishUntil: at(addDays(T, -20), '23:45'),
      showOnHomepage: true,
    },
  )

  // Weekly bulletin
  docs.push({
    _id: `sample-bulletin-${sunday}`,
    _type: 'weeklyBulletin',
    weekStart: sunday,
    weekEnd: addDays(sunday, 6),
    liturgicalNotes: [block('Vzorec: 24. nedelja med letom. V sredo god sv. Kornelija in Ciprijana, v soboto sv. Mateja, apostola.')],
    items: [
      {_type: 'bulletinItem', _key: key(), title: 'Zahvala za ofer', body: [block('Vzorec: pri prejšnjem ofru ste darovali za obnovo strehe. Bog povrni!')]},
      {_type: 'bulletinItem', _key: key(), title: 'Srečanje ŽPS', body: [block('Vzorec: člani župnijskega pastoralnega sveta se sestanejo v torek po večerni maši.')]},
      {_type: 'bulletinItem', _key: key(), title: 'Krst', body: [block('Vzorec: prihodnjo nedeljo bo pri deseti maši krst. Družino priporočamo v molitev.')]},
    ],
    specialInfo: [block('Vzorec: v četrtek maša odpade zaradi dekanijskega srečanja duhovnikov.')],
    events: [ref(ID.eventZegnanje), ref(ID.eventVerouk)],
  })

  // Sacraments
  const sac = (
    id: string,
    title: string,
    kind: string,
    summary: string,
    order: number,
    extra: Record<string, unknown> = {},
  ) => ({
    _id: `sample-sacrament-${id}`,
    _type: 'sacrament',
    title,
    slug: slug(id),
    kind,
    summary,
    order,
    description: [block(`Vzorčno besedilo o zakramentu: ${title.toLowerCase()}. Nadomestite z resničnimi informacijami.`)],
    contact: ref(ID.pastor),
    contactNote: [block('Vzorec: oglasite se v župnišču v času uradnih ur.')],
    ...extra,
  })
  docs.push(
    sac('krst', 'Krst', 'baptism', 'Vzorec: krst otroka prijavijo starši vsaj mesec dni prej. Priprava je v župnišču.', 1, {
      image: sacramentImg,
      requirements: ['Vsaj eden od staršev je katoličan', 'Boter je birman katoličan'],
      steps: [
        {_type: 'step', _key: key(), title: 'Prijava v župnišču', text: [block('Vzorec: starši prinesejo rojstni list otroka.')]},
        {_type: 'step', _key: key(), title: 'Priprava', text: [block('Vzorec: eno srečanje za starše in botre.')]},
        {_type: 'step', _key: key(), title: 'Krst', text: [block('Vzorec: praviloma ob nedeljah pri sveti maši ali po njej.')]},
      ],
      documentsNeeded: ['Rojstni list otroka', 'Potrdilo o botrovi primernosti (če je iz druge župnije)'],
      downloads: [ref(ID.docKrst)],
      faq: [
        {_type: 'faqItem', _key: key(), question: 'Ali sta lahko botra dva?', answer: [block('Vzorec: da, boter in botra.')]},
        {_type: 'faqItem', _key: key(), question: 'Kaj če nisva poročena?', answer: [block('Vzorec: pogovorite se z župnikom; krst je mogoč.')]},
      ],
    }),
    sac('prvo-sveto-obhajilo', 'Prvo sveto obhajilo', 'communion', 'Vzorec: priprava poteka v 3. razredu verouka; slovesnost je maja.', 2),
    sac('sveta-birma', 'Sveta birma', 'confirmation', 'Vzorec: priprava v 8. in 9. razredu; birma vsaki dve leti.', 3),
    sac('poroka', 'Sveta poroka', 'marriage', 'Vzorec: prijavite se vsaj tri mesece pred poroko; potrebna je priprava na zakon.', 4, {
      documentsNeeded: ['Krstni list (ne starejši od 6 mesecev)', 'Potrdilo o opravljeni pripravi'],
    }),
    sac('spoved', 'Sveta spoved', 'confession', 'Vzorec: pol ure pred vsako sveto mašo in po dogovoru.', 5),
    sac('bolnisko-maziljenje', 'Bolniško maziljenje', 'anointing', 'Vzorec: pokličite kadarkoli; za bolne na domu duhovnik pride na obisk.', 6),
    sac('pogreb', 'Pogreb', 'funeral', 'Vzorec: svojci se oglasijo v župnišču čim prej po smrti; datum uskladimo s pogrebno službo.', 7, {
      documentsNeeded: ['Mrliški list ali potrdilo pogrebne službe'],
    }),
  )

  // Catechesis
  const session = (weekday: string, time: string, location: string) => ({_type: 'session', _key: key(), weekday, time, location})
  const schoolYear = `${T.slice(0, 4)}/${Number(T.slice(0, 4)) + 1}`
  docs.push(
    {
      _id: 'catechesisPage',
      _type: 'catechesisPage',
      title: 'Verouk',
      schoolYear,
      intro: [block('Vzorčno besedilo: verouk je namenjen otrokom od 1. do 9. razreda. Poteka enkrat tedensko v veroučnih učilnicah v župnišču.')],
      enrollment: [block('Vzorec: vpis poteka v septembru v času uradnih ur. Prinesite izpolnjeno prijavnico.')],
      contact: ref(ID.pastor),
      documents: [ref(ID.docPrijavnica)],
      notice: [block('Vzorec obvestila: prvi teden verouka začnemo s sveto mašo v nedeljo ob 10.00.')],
    },
    {
      _id: 'sample-catgroup-1',
      _type: 'catechesisGroup',
      title: '1. razred',
      grade: 1,
      schoolYear,
      catechist: ref(ID.catechist1),
      sessions: [session('tuesday', '16:00', 'Veroučna učilnica 1')],
    },
    {
      _id: 'sample-catgroup-2',
      _type: 'catechesisGroup',
      title: '2. razred',
      grade: 2,
      schoolYear,
      catechist: ref(ID.catechist1),
      sessions: [session('tuesday', '17:00', 'Veroučna učilnica 1')],
    },
    {
      _id: 'sample-catgroup-3',
      _type: 'catechesisGroup',
      title: '3. razred — priprava na prvo obhajilo',
      grade: 3,
      schoolYear,
      catechist: ref(ID.pastor),
      sessions: [session('wednesday', '16:00', 'Veroučna učilnica 2')],
      notes: [block('Vzorec: starši so vabljeni na mesečna srečanja.')],
    },
    {
      _id: 'sample-catgroup-8',
      _type: 'catechesisGroup',
      title: 'Birmanci (8. in 9. razred)',
      grade: 8,
      schoolYear,
      catechistName: 'Vzorčni katehet',
      sessions: [session('friday', '18:00', 'Župnišče, dvorana')],
      documents: [ref(ID.docPrijavnica)],
    },
  )

  // Special period (active around today)
  docs.push({
    _id: ID.period,
    _type: 'specialPeriod',
    title: 'Farno žegnanje (vzorec)',
    slug: slug('farno-zegnanje-vzorec'),
    activeFrom: addDays(T, -2),
    activeUntil: addDays(T, 3),
    season: 'pentecost',
    image: periodImg,
    message: [
      block('Vzorčno besedilo posebnega obdobja. Ob prazniku Povišanja sv. Križa praznujemo farno žegnanje.'),
      block('Program', 'h2'),
      ...bullets(['sobota zvečer: molitvena ura', 'nedelja: slovesna maša in druženje', 'ponedeljek: maša za rajne župljane']),
    ],
    schedule: ref(ID.scheduleFeast),
    officeHoursNote: 'Vzorec: v tednu žegnanja so uradne ure samo po dogovoru.',
    events: [ref(ID.eventZegnanje)],
    announcements: [ref(ID.annRomanje)],
  })

  // Pages
  docs.push(
    {
      _id: ID.pageAbout,
      _type: 'page',
      title: 'O župniji',
      slug: slug('o-zupniji'),
      intro: 'Vzorčni uvod: župnija Pirniče leži pod Šmarno goro ob Savi in združuje vasi Zgornje in Spodnje Pirniče, Vikrče in Verje.',
      sections: [
        {_type: 'sectionRichText', _key: key(), title: 'Kratka predstavitev', body: [block('Vzorčno besedilo. Opišite župnijo, njeno zgodovino in današnje življenje.')]},
        {_type: 'sectionQuote', _key: key(), quote: 'Kjer sta namreč dva ali so trije zbrani v mojem imenu, tam sem sredi med njimi.', source: 'Mt 18,20'},
        {_type: 'sectionTextImage', _key: key(), title: 'Župnišče', body: [block('Vzorec: v župnišču so pisarna, veroučne učilnice in dvorana za srečanja.')], image: heroImg, imageSide: 'right'},
        {_type: 'sectionFaq', _key: key(), title: 'Pogosta vprašanja', items: [
          {_type: 'faqItem', _key: key(), question: 'Kje dobim krstni list?', answer: [block('Vzorec: v župnišču v času uradnih ur; lahko tudi po e-pošti.')]},
          {_type: 'faqItem', _key: key(), question: 'Kako naročim sveto mašo?', answer: [block('Vzorec: osebno v zakristiji po maši ali v župnišču.')]},
        ]},
      ],
    },
    {
      _id: ID.pagePrivacy,
      _type: 'page',
      title: 'Zasebnost',
      slug: slug('zasebnost'),
      intro: 'Kako spletna stran ravna z vašimi podatki.',
      sections: [
        {_type: 'sectionRichText', _key: key(), body: [
          block('Spletna stran ne uporablja piškotkov za sledenje in ne vključuje orodij za analitiko tretjih oseb.'),
          block('Kontaktni obrazec', 'h2'),
          block('Podatke, ki jih vpišete v kontaktni obrazec (ime, e-pošta, telefon, sporočilo), uporabimo izključno za odgovor na vaše sporočilo. Sporočilo prejme župnijska pisarna po e-pošti.'),
          block('Fotografije', 'h2'),
          block('Vzorec: fotografije z dogodkov objavljamo v skladu s pravili župnije; za odstranitev fotografije nam pišite.'),
          block('Upravljavec', 'h2'),
          block('Vzorec: upravljavec podatkov je Župnija Pirniče. To besedilo naj pregleda odgovorna oseba.'),
        ]},
      ],
    },
  )

  // Singletons
  docs.push(
    {
      _id: 'settings',
      _type: 'settings',
      name: 'Župnija Pirniče',
      tagline: 'Vzorčno besedilo: župnijska skupnost pod Šmarno goro. Nadomestite z resničnim opisom.',
      diocese: 'Nadškofija Ljubljana (vzorec — preverite dekanijo)',
      pastor: ref(ID.pastor),
      address: {_type: 'address', street: 'Zgornje Pirniče 1 (vzorec)', postalCode: '1215', city: 'Medvode'},
      phone: '01 000 00 00 (vzorec)',
      mobile: '041 000 000 (vzorec)',
      email: 'zupnija.pirnice@example.si',
      contactFormRecipient: 'zupnija.pirnice@example.si',
      officeHours: [
        {_type: 'openingHours', _key: key(), weekday: 'tuesday', from: '16:00', to: '18:00'},
        {_type: 'openingHours', _key: key(), weekday: 'thursday', from: '09:00', to: '11:00'},
        {_type: 'openingHours', _key: key(), weekday: 'friday', from: '16:00', to: '18:00', note: 'ali po sveti maši'},
      ],
      officeHoursNote: [block('Vzorec: ob praznikih uradnih ur ni. Za nujne primere pokličite.')],
      emergencyContact: {label: 'Za bolniško maziljenje in pogreb', phone: '041 000 000 (vzorec)'},
      donations: {
        intro: [block('Vzorec: s svojim darom podpirate vzdrževanje cerkva in župnijsko dejavnost.')],
        recipient: 'Župnija Pirniče',
        iban: 'SI56 0000 0000 0000 000 (vzorec)',
        purpose: 'Dar za župnijo',
      },
      siteUrl: 'http://localhost:3000',
      seo: {_type: 'seo', description: 'Vzorčni opis: svete maše, oznanila, dogodki in verouk v župniji Pirniče.'},
      footerText: [block('Vzorec: fotografije so last župnije.')],
      privacyPage: ref(ID.pagePrivacy),
    },
    {
      _id: 'homePage',
      _type: 'homePage',
      heroImage: heroImg,
      heroText: 'Vzorčno besedilo dobrodošlice. Dobrodošli v župnijski skupnosti pod Šmarno goro.',
      welcome: {
        title: 'Dobrodošli med nami',
        text: [block('Vzorčni nagovor župnika. Nekaj mirnih povedi o tem, kaj župnija je in kako se ji lahko pridružite.')],
        image: groupImg,
        link: {_type: 'link', label: 'Več o župniji', kind: 'internal', internal: ref(ID.pageAbout)},
      },
      featuredLinks: [
        {_type: 'link', _key: key(), label: 'Vpis k verouku', kind: 'internal', internal: ref(ID.annImportant)},
        {_type: 'link', _key: key(), label: 'Romanje na Brezje', kind: 'internal', internal: ref(ID.eventRomanje)},
      ],
    },
  )

  console.log(`Zapisujem ${docs.length} dokumentov …`)
  const tx = client.transaction()
  for (const doc of docs) tx.createOrReplace(doc as {_id: string; _type: string})
  await tx.commit()
  console.log('Vzorčna vsebina je vpisana.')
}

;(async () => {
  if (clean) await removeSamples()
  else await seed()
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
