/**
 * Fills the website with real parish content taken from the monthly
 * »Oznanila župnije Pirniče« (May–October 2026) and the verouk enrolment
 * form 2025/2026 published on https://pirnice.si/zupnija-pirnice:
 * oznanila PDFs, announcements, the weekly bulletin, events, news (the
 * pastor's lead articles), parish groups, sacraments, verouk, and the
 * »O župniji« and privacy pages.
 *
 *   npx sanity exec scripts/seed-parish-content.ts --with-user-token
 *
 * Run after seed-parish-data.ts and add-parish-images.ts (it reuses their
 * documents and photos). Safe to re-run: documents have fixed ids.
 *
 * The November 2026 meetings are derived from the rules the September
 * bulletin states (ŽPS first Tuesday, Karitas third Tuesday, married
 * couples' groups second and fourth Wednesday). Check them against the
 * November bulletin.
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-09-14'})

// ───────────────────────── helpers ─────────────────────────

let keyCounter = 0
const key = () => `c${(keyCounter++).toString(36)}${Date.now().toString(36).slice(-3)}`

function block(text: string, style: 'normal' | 'h2' | 'h3' | 'blockquote' = 'normal') {
  return {_type: 'block', _key: key(), style, markDefs: [], children: [{_type: 'span', _key: key(), text, marks: []}]}
}
const blocks = (...paragraphs: string[]) => paragraphs.map((p) => block(p))
function bullets(items: string[]) {
  return items.map((text) => ({...block(text), listItem: 'bullet', level: 1}))
}

const ref = (id: string) => ({_type: 'reference', _ref: id})
const slug = (current: string) => ({_type: 'slug', current})

/** Last Sunday of a month (1-based), as day of month. */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0))
  return last.getUTCDate() - last.getUTCDay()
}
/** Local Ljubljana time → ISO string, with the EU summer-time rule. */
function at(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const summer =
    (m > 3 && m < 10) || (m === 3 && d >= lastSunday(y, 3)) || (m === 10 && d < lastSunday(y, 10))
  return new Date(`${date}T${time}:00${summer ? '+02:00' : '+01:00'}`).toISOString()
}

const UA = 'zupnija-pirnice-seed/1.0 (https://zupnija-pirnice.si)'
async function pdf(url: string, filename: string) {
  const res = await fetch(url, {headers: {'User-Agent': UA}})
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const asset = await client.assets.upload('file', Buffer.from(await res.arrayBuffer()), {
    filename,
    contentType: 'application/pdf',
    source: {name: 'pirnice.si', id: url, url},
  })
  console.log('  PDF', filename)
  return {_type: 'file', asset: ref(asset._id)}
}

/** Photo already uploaded by add-parish-images.ts, looked up by its Commons file name. */
async function photo(filename: string, alt: string) {
  const asset = await client.fetch<{_id: string; creditLine?: string} | null>(
    `*[_type == "sanity.imageAsset" && originalFilename == $filename][0]{_id, creditLine}`,
    {filename},
  )
  if (!asset) throw new Error(`Run add-parish-images.ts first (missing ${filename})`)
  return {_type: 'imageWithAlt', asset: ref(asset._id), alt, ...(asset.creditLine ? {caption: asset.creditLine} : {})}
}

// ───────────────────────── ids ─────────────────────────

const PASTOR = 'person-blaz-jezersek'
const CATECHIST = 'person-marija-ilc'
const MARIJA = 'church-marijino-vnebovzetje'
const KRIZ = 'church-sv-kriz'

const ID = {
  zps: 'group-zps',
  karitas: 'group-karitas',
  zakonska1: 'group-zakonska-1',
  zakonska2: 'group-zakonska-2',
  molitvena: 'group-molitvena',
  mladinska: 'group-mladinska',
  zbor: 'group-pevski-zbor',
  pageAbout: 'page-o-zupniji',
  pagePrivacy: 'page-zasebnost',
  docPrijavnica: 'doc-prijavnica-verouk-2025-2026',
}

const BULLETINS = [
  {month: 'oktober', date: '2026-10-01', id: 1161},
  {month: 'september', date: '2026-09-01', id: 1160},
  {month: 'avgust', date: '2026-08-01', id: 1159},
  {month: 'junij', date: '2026-06-01', id: 1155},
  {month: 'maj', date: '2026-05-01', id: 1154},
]

async function run() {
  console.log('Nalagam dokumente …')
  const bulletinFiles = new Map<string, {_type: string; asset: unknown}>()
  for (const b of BULLETINS) {
    bulletinFiles.set(b.month, await pdf(`https://www.pirnice.si/download_file/view/${b.id}/489`, `oznanila-${b.month}-2026.pdf`))
  }
  const prijavnicaFile = await pdf('https://www.pirnice.si/download_file/view/1141/893', 'prijavnica-verouk-2025-2026.pdf')

  const imgKriz = await photo('Spodnje Pirnice, Holy Cross church 01.jpg', 'Cerkev Povišanja svetega Križa v Spodnjih Pirničah')
  const imgKrizView = await photo('Spodnje Pirniče 2024.jpg', 'Spodnje Pirniče s cerkvijo svetega Križa na vzpetini')
  const imgTomaz = await photo("Zgornje Pirnice, St. Thomas' filial church.jpg", 'Cerkev sv. Tomaža in okrogla Marijina cerkev v Zgornjih Pirničah')
  const imgZgornje = await photo('Zgornje Pirniče 02.jpg', 'Zgornje Pirniče z Marijino cerkvijo')
  const imgFields = await photo('Zgornje Pirniče 01.jpg', 'Polja pred Zgornjimi Pirničami')

  const docs: Record<string, unknown>[] = []

  // ── People ──
  docs.push({
    _id: CATECHIST,
    _type: 'person',
    name: 'Marija Ilc',
    slug: slug('marija-ilc'),
    role: 'catechist',
    roleTitle: 'katehistinja',
    showContact: false,
    order: 10,
  })

  // ── Documents: monthly oznanila + verouk form ──
  for (const b of BULLETINS) {
    docs.push({
      _id: `doc-oznanila-2026-${b.date.slice(5, 7)}`,
      _type: 'parishDocument',
      title: `Oznanila – ${b.month} 2026`,
      file: bulletinFiles.get(b.month),
      category: 'bulletins',
      date: b.date,
      description: `Mesečna oznanila župnije Pirniče za ${b.month} 2026: koledar svetih maš z nameni in župnijska obvestila.`,
      public: true,
    })
  }
  docs.push({
    _id: ID.docPrijavnica,
    _type: 'parishDocument',
    title: 'Prijavnica in pravilnik veroučne šole 2025/2026',
    file: prijavnicaFile,
    category: 'catechesis',
    date: '2025-08-25',
    description: 'Prijavnica za verouk, pravilnik veroučne šole, cene delovnih zvezkov in urnik za veroučno leto 2025/2026.',
    public: true,
  })

  // ── Groups ──
  docs.push(
    {
      _id: ID.zps,
      _type: 'parishGroup',
      title: 'Župnijski pastoralni svet (ŽPS)',
      slug: slug('zupnijski-pastoralni-svet'),
      summary: 'Sodelavci, ki z župnikom načrtujejo in spremljajo življenje župnije.',
      description: blocks('Redne mesečne seje ŽPS so ob prvih torkih v mesecu ob 19.15 v župnišču.'),
      meetingSchedule: 'Prvi torek v mesecu ob 19.15',
      location: 'Župnišče',
      contactPerson: ref(PASTOR),
      order: 0,
    },
    {
      _id: ID.karitas,
      _type: 'parishGroup',
      title: 'Župnijska Karitas Pirniče',
      slug: slug('zupnijska-karitas'),
      summary: 'Sodelavci Župnijske Karitas Pirniče s skupnimi močmi udejanjamo ljubezen do bližnjega.',
      description: [
        block('Župnijska Karitas Pirniče je bila ustanovljena z namenom, da konkretizira krščansko ljubezen.'),
        block('Uradne ure so vsak prvi ponedeljek v mesecu od 17. do 18. ure v mežnariji v Spodnjih Pirničah. Sodelavci se srečujejo vsak tretji torek v mesecu ob 19.15 v župnišču.'),
        block('Molitvena skupina Karitas se k molitvi za zdravje srečuje ob torkih ob 18.00 ob kipu Kraljice miru v Marijini cerkvi.'),
        block('Dar za Karitas: SI56 0202 1025 3468 769.'),
      ],
      meetingSchedule: 'Uradne ure vsak 1. ponedeljek v mesecu od 17. do 18. ure',
      location: 'Mežnarija v Spodnjih Pirničah',
      contactName: 'Jera Rak',
      email: 'karitas.pirnice@gmail.com',
      phone: '031 422 688',
      order: 1,
    },
    {
      _id: ID.molitvena,
      _type: 'parishGroup',
      title: 'Molitvena skupina',
      slug: slug('molitvena-skupina'),
      summary: 'Vsako sredo ob 18.00 v Marijini cerkvi. Toplo povabljeni, da se nam pridružite v Marijini cerkvi ali v duhu.',
      meetingSchedule: 'Vsako sredo ob 18.00',
      location: 'Marijina cerkev',
      order: 2,
    },
    {
      _id: ID.zakonska1,
      _type: 'parishGroup',
      title: 'Prva zakonska skupina',
      slug: slug('prva-zakonska-skupina'),
      summary: 'Srečanja zakoncev vsako drugo sredo v mesecu.',
      meetingSchedule: 'Druga sreda v mesecu ob 20.15',
      location: 'Župnišče',
      order: 3,
    },
    {
      _id: ID.zakonska2,
      _type: 'parishGroup',
      title: 'Druga zakonska skupina',
      slug: slug('druga-zakonska-skupina'),
      summary: 'Srečanja zakoncev vsako četrto sredo v mesecu. Vabljeni novi člani!',
      meetingSchedule: 'Četrta sreda v mesecu ob 20.00',
      location: 'Župnišče',
      order: 4,
    },
    {
      _id: ID.mladinska,
      _type: 'parishGroup',
      title: 'Mladinska skupina',
      slug: slug('mladinska-skupina'),
      summary: 'Srečanja mladih ob sobotah. V preteklem letu se jih je udeleževalo 5 do 10 mladincev.',
      meetingSchedule: 'Ob sobotah (termini v mesečnih oznanilih)',
      location: 'Župnišče',
      contactPerson: ref(PASTOR),
      order: 5,
    },
    {
      _id: ID.zbor,
      _type: 'parishGroup',
      title: 'Odrasli pevski zbor',
      slug: slug('odrasli-pevski-zbor'),
      summary: 'Odrasli pevski zbor župnije Pirniče poje pri bogoslužju. Vaje so v pevski sobi v župnišču.',
      location: 'Pevska soba v župnišču',
      order: 6,
    },
  )

  // ── Events ──
  type Ev = {
    id: string
    title: string
    start: string
    end?: string
    allDay?: boolean
    church?: string
    locationName?: string
    category: string
    summary: string
    description?: string[]
    organizer?: string
    featured?: boolean
    image?: object
  }
  const ev = (e: Ev) => ({
    _id: `event-${e.id}`,
    _type: 'event',
    title: e.title,
    slug: slug(e.id),
    start: e.start,
    ...(e.end ? {end: e.end} : {}),
    ...(e.allDay ? {allDay: true} : {}),
    ...(e.church ? {church: ref(e.church)} : {}),
    ...(e.locationName ? {locationName: e.locationName} : {}),
    category: e.category,
    summary: e.summary,
    ...(e.description ? {description: blocks(...e.description)} : {}),
    ...(e.organizer ? {organizer: ref(e.organizer)} : {}),
    ...(e.featured ? {featured: true} : {}),
    ...(e.image ? {image: e.image} : {}),
  })
  docs.push(
    ev({
      id: 'telovo-2026',
      title: 'Sveto Rešnje Telo in Kri – procesija',
      start: at('2026-06-04', '18:30'),
      church: MARIJA,
      category: 'liturgy',
      summary: 'Sveti maši ob 8.00 v cerkvi Svetega Križa in ob 18.30 v Marijini cerkvi, po večerni maši procesija.',
      description: [
        'Praznik Svetega Rešnjega Telesa in Krvi je zapovedan praznik, kar pomeni, da je udeležba pri sveti maši ta dan obvezna. Po večerni maši bo procesija po ustaljenih navadah.',
        'Lepo bo, če boste otroci – sploh prvoobhajanci – pred Najsvetejšim potresali cvetje, odrasli pa okrasili pročelja vaših hiš. Vsi udeleženci ste toplo povabljeni, da pri procesiji sodelujete z molitvijo rožnega venca.',
      ],
    }),
    ev({
      id: 'sklep-veroucnega-leta-2026',
      title: 'Sklep veroučnega leta in srečanje bolnih in ostarelih',
      start: at('2026-06-07', '10:00'),
      church: MARIJA,
      category: 'catechesis',
      summary: 'Med mašo priložnost za bolniško maziljenje, po maši veroučna spričevala in družabno srečanje.',
      description: [
        'Sveta maša bo kot običajno ob 10.00, med njo pa bo tudi priložnost za prejem zakramenta bolniškega maziljenja.',
        'Po maši bodo veroučenci prejeli veroučna spričevala, za povabljene z drugega konca življenjskega spektra pa bo v prehodu med Marijino cerkvijo in župniščem še družabno srečanje.',
      ],
    }),
    ev({
      id: 'zupnijski-dan-2026',
      title: 'Marijino vnebovzetje – župnijski dan',
      start: at('2026-08-15', '08:00'),
      end: at('2026-08-15', '11:00'),
      church: MARIJA,
      category: 'feast',
      summary: 'Naša župnija svoj rojstni dan obhaja na praznik Marijinega vnebovzetja. Sveti maši ob 8.00 in 10.00.',
      image: imgZgornje,
    }),
    ev({
      id: 'oratorij-2026',
      title: 'Oratorij »Živeti je lepo!«',
      start: at('2026-08-17', '09:00'),
      end: at('2026-08-21', '16:00'),
      locationName: 'Župnišče in Marijina cerkev',
      category: 'youth',
      summary: 'Počitniški oratorij z deklico Heidi, od ponedeljka do petka vsak dan od 9.00 do 16.00.',
      description: [
        'Osrednja osebnost oratorija bo deklica Heidi, ki bo otroke navdušila s svojim nalezljivim čudenjem in veseljem nad lepoto narave in življenja.',
        'Otroci se bodo od ponedeljka do petka vsako jutro zbirali ob 9.00 in potem skupaj v igri in druženju preživeli 7 ur. Ob 16.00 bomo spustili oratorijsko zastavo.',
        'Oratorij bomo sklenili s sveto mašo v Marijini cerkvi v petek ob 15.00.',
      ],
    }),
    ev({
      id: 'katehetska-masa-2026',
      title: 'Katehetska maša in blagoslov šolskih torb',
      start: at('2026-09-06', '10:00'),
      church: MARIJA,
      category: 'catechesis',
      summary: 'Šolarji, pridite k maši s šolskimi torbicami, ki jih bomo ob začetku maše blagoslovili.',
    }),
    ev({
      id: 'koncert-kd-jakoba-aljaza',
      title: 'Koncert: solisti KD Jakoba Aljaža',
      start: at('2026-09-19', '19:30'),
      church: MARIJA,
      category: 'culture',
      summary: 'Prvi od štirih glasbenih večerov mednarodnega koncertnega cikla klasične glasbe v Pirničah.',
    }),
    ev({
      id: 'zegnanje-2026',
      title: 'Žegnanje',
      start: at('2026-09-20', '08:00'),
      allDay: true,
      category: 'feast',
      summary: 'Žegnanje ob prazniku Povišanja svetega Križa.',
      image: imgKriz,
    }),
    ev({
      id: 'koncert-baroka',
      title: 'Koncert baročne glasbe',
      start: at('2026-09-26', '19:30'),
      church: MARIJA,
      category: 'culture',
      summary: 'Kljunaste flavte in basso continuo.',
    }),
    ev({
      id: 'koncert-trio-kljunastih-flavt',
      title: 'Koncert tria kljunastih flavt',
      start: at('2026-09-28', '19:30'),
      church: KRIZ,
      category: 'culture',
      summary: 'Koncert v cerkvi Povišanja svetega Križa.',
    }),
    ev({
      id: 'orgelski-koncert-vatikanske-skrivnosti',
      title: 'Orgelski koncert »Vatikanske skrivnosti«',
      start: at('2026-09-29', '19:15'),
      church: MARIJA,
      category: 'culture',
      summary: 'Orgelski koncert organista Rudolfa Cerca.',
    }),
    ev({
      id: 'srecanje-zakonskih-jubilantov-2026',
      title: 'Srečanje zakonskih jubilantov',
      start: at('2026-10-17', '18:30'),
      church: MARIJA,
      category: 'families',
      summary: 'Sveta maša in koncert skupine Vocabella, nato družabno srečanje za povabljene pare v dvorani pod cerkvijo.',
      description: [
        'Srečanje zakonskih jubilantov, ki ste v tem letu obhajali okroglo ali polokroglo obletnico sklenitve svetega zakona.',
        'Letos bo srečanje povzdignilo gostovanje glasbene skupine Vocabella, zato ste k maši (in koncertu po njej) toplo povabljeni tudi, če niste jubilanti.',
      ],
    }),
    ev({
      id: 'romanje-trsat-2026',
      title: 'Župnijsko romanje na Trsat',
      start: at('2026-10-24', '07:00'),
      end: at('2026-10-24', '20:00'),
      locationName: 'Odhod izpred Mihovca',
      category: 'pilgrimage',
      summary: 'Romanje k Trsatski Materi Božji, z ustavitvama na Premu in na Vremskem Britofu.',
      description: [
        'Na Trsatu bomo imeli sveto mašo, ogled delov frančiškanskega samostana ter kipa sv. Janeza Pavla II., ki je Trsat obiskal leta 2003. Po poti se bomo ustavili še v cerkvi na Premu ter pri Mariji Vnebovzeti na Vremskem Britofu.',
        'Cena romanja je 40 € na osebo, za otroke do 15. leta je romanje brezplačno. S seboj imejte veljaven osebni dokument.',
      ],
    }),
    ev({
      id: 'cescenje-2026',
      title: 'Češčenje Svetega Rešnjega Telesa',
      start: at('2026-10-25', '15:00'),
      end: at('2026-10-25', '19:30'),
      church: KRIZ,
      category: 'liturgy',
      summary: 'Češčenje med 15.00 in 18.30, sklenemo z litanijami Srca Jezusovega in sveto mašo ob 18.30.',
    }),
    ev({
      id: 'seja-zps-2026-11',
      title: 'Seja župnijskega pastoralnega sveta',
      start: at('2026-11-03', '19:15'),
      locationName: 'Župnišče',
      category: 'meeting',
      summary: 'Redna mesečna seja ŽPS.',
      organizer: ID.zps,
    }),
    ev({
      id: 'prva-zakonska-skupina-2026-11',
      title: 'Srečanje prve zakonske skupine',
      start: at('2026-11-11', '20:15'),
      locationName: 'Župnišče',
      category: 'families',
      summary: 'Mesečno srečanje prve zakonske skupine.',
      organizer: ID.zakonska1,
    }),
    ev({
      id: 'sodelavci-karitas-2026-11',
      title: 'Srečanje sodelavcev Karitas',
      start: at('2026-11-17', '19:15'),
      locationName: 'Župnišče',
      category: 'caritas',
      summary: 'Mesečno srečanje sodelavcev Župnijske Karitas Pirniče.',
      organizer: ID.karitas,
    }),
    ev({
      id: 'druga-zakonska-skupina-2026-11',
      title: 'Srečanje druge zakonske skupine',
      start: at('2026-11-25', '20:00'),
      locationName: 'Župnišče',
      category: 'families',
      summary: 'Mesečno srečanje druge zakonske skupine. Vabljeni novi člani!',
      organizer: ID.zakonska2,
    }),
  )

  // ── News: the pastor's lead articles and reports from the bulletins ──
  type Art = {id: string; title: string; excerpt: string; date: string; body: object[]; image?: object; attachMonth?: string}
  const art = (a: Art) => ({
    _id: `article-${a.id}`,
    _type: 'article',
    title: a.title,
    slug: slug(a.id),
    excerpt: a.excerpt,
    body: a.body,
    publishedAt: at(a.date, '08:00'),
    author: ref(PASTOR),
    ...(a.image ? {image: a.image} : {}),
    ...(a.attachMonth
      ? {attachments: [{_type: 'attachment', _key: key(), title: `Oznanila – ${a.attachMonth} 2026 (PDF)`, file: bulletinFiles.get(a.attachMonth)}]}
      : {}),
  })
  docs.push(
    art({
      id: 'roznovenska-mati-bozja',
      title: 'Rožnovenska Mati Božja',
      date: '2026-10-01',
      excerpt: 'God Rožnovenske Matere Božje nas vabi k ponovnemu odkritju ene najbolj prepoznavnih in rodovitnih molitev v zakladnici Cerkve.',
      image: imgZgornje,
      attachMonth: 'oktober',
      body: [
        ...blocks(
          'God Rožnovenske Matere Božje, ki ga Cerkev obhaja 7. oktobra, nosi v sebi izjemno prepletenost zgodovine, duhovnosti in osebnega izkustva vere. Praznik ne slavi zgolj zgodovinske zmage, temveč nas vabi k ponovnemu odkritju ene najbolj prepoznavnih in rodovitnih molitev v zakladnici Cerkve.',
          'Izvor praznika sega v burno 16. stoletje. Dne 7. oktobra 1571 se je v Korintskem zalivu odvila pomorska bitka pri Lepantu, v kateri se je krščansko ladjevje Svete lige soočilo z močnejšim otomanskim ladjevjem. Papež Pij V. se je zavedal usodnosti trenutka za prihodnost Evrope, zato je vse vernike pozval k vztrajni molitvi rožnega venca. Ko je združena mornarica nepričakovano zmagala, je papež uspeh brez obotavljanja pripisal priprošnji Božje Matere. Leta 1572 je uvedel spominski dan »Marije Zmagovalke«, ki ga je njegov naslednik Gregor XIII. preimenoval v praznik svetega rožnega venca. Praznik se je sprva obhajal le v cerkvah z rožnovenskimi bratovščinami, papež Pij X. pa je leta 1913 praznik ukazal za vso Cerkev in določil današnji stalni datum.',
          'Lepota rožnega venca pa presega vojaške in politične okvire ter nagovarja človeka v njegovi najgloblji notranjosti. Čeprav se nenehno ponavljata očenaš in zdravamarija, je rožni venec v resnici izrazito kristocentrična molitev. Preko štirih delov – veselega, svetlega, žalostnega in častitljivega – se sprehodimo skozi celotno zgodovino odrešenja. Gre za kontemplacijo Kristusovega obličja v šoli Marije, ki je vse te dogodke zvesto ohranjala in premišljevala v svojem srcu.',
          'Ritmično ponavljanje besed deluje pomirjujoče; ustvarja varen duhovni prostor, v katerem se um umiri, misli pa se osredotočijo na skrivnosti vere. Preprosto prebiranje jagod med prsti pomaga zasidrati duha v sedanjem trenutku in prepojiti telo z molitvijo. Rožnovenska Mati Božja nas torej spominja, da najmočnejše orožje duha niso hrupne besede, temveč vztrajna, zbrana molitev, ki spreminja srce in prenavlja svet.',
        ),
      ],
    }),
    art({
      id: 'povisanje-svetega-kriza',
      title: 'Povišanje svetega Križa',
      date: '2026-09-01',
      excerpt: 'Križ, ki je bil v rimskem svetu simbol sramote, po Kristusovem vstajenju postane znamenje zmage, upanja in odrešenja.',
      image: imgKriz,
      attachMonth: 'september',
      body: blocks(
        'Praznik Povišanja svetega križa, ki ga Cerkev obhaja 14. septembra, v središče postavlja temeljno znamenje krščanske vere. Križ, ki je bil v rimskem svetu simbol sramote in najhujšega kaznovanja, po Kristusovem vstajenju postane znamenje zmage, upanja in odrešenja.',
        'Korenine praznika segajo v 4. stoletje in so tesno povezane z dvema ključnima zgodovinskima dogodkoma. Cesarica Helena, mati cesarja Konstantina Velikega, se je okoli leta 326 podala na romanje v Sveto deželo, kjer je po izročilu na Kalvariji našla ostanke pravega Kristusovega križa. Na tem mestu je Konstantin dal zgraditi mogočno baziliko Božjega groba (Anastasis). Posvečena je bila 13. septembra 335, dan kasneje, 14. septembra, pa so relikvijo križa prvič slovesno dvignili (povišali) in jo postavili zbranemu ljudstvu v češčenje.',
        'Praznik je dobil nov zagon v 7. stoletju. Leta 614 je perzijski kralj Kozroj II. zavzel Jeruzalem, opustošil svete kraje in kot vojni plen odnesel relikvijo svetega križa. Bizantinski cesar Heraklij je po dolgotrajni vojni premagal Perzijce in relikvijo zmagovito vrnil v Jeruzalem. Izročilo pravi, da je želel cesar v polnem vladarskem sijaju sam prinesti križ na Kalvarijo, a se je ustavil pred zaprtimi mestnimi vrati; šele ko je po opozorilu patriarha Zaharija odložil krono, se sezul in oblekel spokorna oblačila, je lahko vstopil in povišal križ.',
        'V rimskem bogoslužju sta dolgo obstajala dva praznika: Najdba svetega križa (3. maja) in Povišanje svetega križa (14. septembra). Z liturgično prenovo po drugem vatikanskem koncilu sta se praznovanji združili v en sam praznik 14. septembra.',
      ),
    }),
    art({
      id: 'marijino-vnebovzetje',
      title: 'Marijino vnebovzetje – rojstni dan naše župnije',
      date: '2026-08-01',
      excerpt: 'Naša mlada župnija svoj rojstni dan obhaja na enega najlepših in najstarejših krščanskih praznikov.',
      image: imgTomaz,
      attachMonth: 'avgust',
      body: blocks(
        'Naša mlada župnija svoj rojstni dan obhaja na enega najlepših in najstarejših krščanskih praznikov – na praznik Marijinega vnebovzetja. Ko se sredi avgusta zberemo v cerkvi, morda tu, pri nas, morda v kakem od številnih Marijanskih romarskih središč, se včasih vprašamo: Kaj pravzaprav praznujemo? Ali gre le za spomin na nekaj, kar se je zgodilo pred stoletji, ali pa ima ta praznik neposredno zvezo z našim vsakdanjim življenjem?',
        'Marijino vnebovzetje pomeni, da je bila Marija, Jezusova mati, po koncu svojega zemeljskega življenja s telesom in dušo vzeta v nebeško slavo. To je temeljna resnica naše vere. Vendar liturgija – torej praznično bogoslužje Cerkve – te resnice ne razlaga z zapletenimi teološkimi pojmi, ampak jo izpoveduje s pesmijo, molitvijo in simboli.',
        'Marija ni neka nedosegljiva zvezda, ampak je ena izmed nas. Kakor mi je Jezusova učenka, a vendarle prva med nami; prva, ki je v popolnem zaupanju Bogu, prehodila pot od tistega njenega »Zgodi se« ob oznanjenju, pa vse do končnega cilja. To, kar je Bog storil z Marijo, obljublja tudi vsakemu izmed nas.',
        'Vnebovzetje zato ni le Marijin praznik, ampak praznik naše prihodnosti. Pove nam, da naše življenje ne gre proti niču ali pozabi, ampak proti polnosti v Bogu. Ko gledamo Marijo v nebesih, gledamo to, kar bomo nekoč, po Božji dobroti in svojem zvestem sodelovanju z Njim, postali tudi mi.',
        'Praznik nam sporoča nekaj čudovitega o našem telesu in ustvarjenem svetu. Krščanstvo ne uči, da je telo le minljiva lupina, ki jo moramo odvreči. Marija je vzeta v nebesa s telesom in dušo. To pomeni, da je vse naše konkretno življenje – naše vsakdanje delo, naši trudi, naše veselje, pa tudi naše bolečine in žulji – dragoceno v Božjih očeh. Zato Marijo v bogoslužju tega praznika povsem upravičeno imenujemo »znamenje trdnega upanja in tolažbe potujočemu Božjemu ljudstvu«.',
      ),
    }),
    art({
      id: 'kristofova-nedelja-miva-2026',
      title: 'Za vozila misijonarjev zbrali skoraj 1000 €',
      date: '2026-08-02',
      excerpt: 'Na Krištofovo nedeljo smo se Bogu zahvalili za srečno prevožene poti in zbrali darove za akcijo MIVA.',
      attachMonth: 'avgust',
      body: blocks(
        'Tretjo julijsko nedeljo smo v katoliški Cerkvi na Slovenskem obhajali kot Krištofovo nedeljo. To je tudi letos zaznamovala akcija MIVA, s katero verniki skušamo našim misijonarjem pomagati do primernih prevoznih sredstev.',
        'Bogu smo se zahvalili za srečno prevožene poti in ob tem zbrali skoraj 1000 € za vozila naših misijonarjev. Prva informacija o višini zbranih sredstev je bila nekoliko nižja, vendar so se nekateri darovalci našli še kasneje, tako da letošnja nabirka v bistvu ne odstopa preveč od povprečja minulih let.',
        'S pomočjo darov, zbranih na Krištofovo nedeljo lani, je MIVA Slovenija s 491.838 € sodelovala pri 21 projektih v 17 misijonskih deželah po svetu. Vsem darovalcem Bog povrni!',
      ),
    }),
    art({
      id: 'verouk-v-stevilkah-2025-2026',
      title: 'Veroučno leto 2025/2026 v številkah',
      date: '2026-06-01',
      excerpt: 'K osnovnošolskemu verouku je v devetih razredih hodilo natanko 100 otrok. 12 jih je prejelo prvo sveto obhajilo, 23 pa sveto birmo.',
      image: imgFields,
      attachMonth: 'junij',
      body: blocks(
        'K osnovnošolskemu verouku je letos v devetih razredih skupaj hodilo natanko 100 otrok; 47 je bilo dečkov in 53 deklic. Največ (15) jih je bilo v osmem, najmanj (7) pa v petem razredu. Prvi razred je letos obiskovalo 14 otrok.',
        '12 otrok je letos pristopilo k prvemu svetemu obhajilu, zakrament svete birme pa je prejelo 23 mladostnikov. Srečanj mladinske skupine se je udeleževalo 5 do 10 mladincev.',
      ),
    }),
    art({
      id: 'sveto-resnje-telo-in-kri',
      title: 'Praznik Svetega Rešnjega Telesa in Krvi',
      date: '2026-05-31',
      excerpt: 'Telovo je praznik hvaležnosti in slavljenja neprecenljivega daru evharistije.',
      image: imgKrizView,
      attachMonth: 'junij',
      body: blocks(
        'Praznik Svetega Rešnjega Telesa in Krvi (telovo) predstavlja enega vrhuncev liturgičnega leta, ko Cerkev javno in slovesno izrazi svojo vero v realno prisotnost Jezusa Kristusa v zakramentu evharistije. Medtem ko veliki četrtek, kot ustanovni dan svete evharistije, ostaja zakoreninjen v resnobnosti Kristusovega trpljenja, je telovo praznik hvaležnosti in slavljenja tega neprecenljivega daru.',
        'Korenine praznika segajo v 13. stoletje v Belgijo, natančneje v škofijo Liège. Ključna osebnost za nastanek praznika je bila sveta Julijana Cornillonska, redovnica in mistikinja, ki je imela od leta 1209 dalje ponavljajoča se videnja polne lune, na kateri je bila opazna črna lisa. Po globoki molitvi je prejela razlago: luna je predstavljala Cerkev, črna lisa pa odsotnost praznika, ki bi posebej častil najsvetejši zakrament.',
        'Lokalni škof Robert je po temeljitem premisleku leta 1246 v svoji škofiji uvedel ta praznik. Ključni premik na raven celotne Cerkve pa se je zgodil po evharističnem čudežu v Bolseni (1263), kjer je hostija med mašo zakrvavela. Papež Urban IV. je leta 1264 praznik razširil na vesoljno Cerkev; pripravo liturgičnih besedil na čast prazniku pa je zaupal sv. Tomažu Akvinskemu.',
        'V 14. stoletju so praznovanje obogatili s procesijami, ki so postale osrednji element praznika. V obdobju protireformacije in po tridentinskem koncilu (1545–1563) je telovo dobilo še močnejši poudarek: postalo je zunanje izpovedovanje katoliške vere. Procesije so postale veličastne manifestacije vere, kjer sta se prepletala sakralni sijaj in ljudska kultura.',
        'Danes, po liturgični prenovi drugega vatikanskega koncila, praznik ohranja svojo globoko teološko noto, a z močnejšim poudarkom na evharistiji kot viru in vrhuncu celotnega krščanskega življenja. Praznik nas danes vabi, da kot Božje ljudstvo ne le prejemamo Kristusa v svetem obhajilu, pač pa postanemo Njegove »monštrance« v svetu – živo znamenje Njegove ljubezni na ulicah našega vsakdana.',
      ),
    }),
  )

  // ── Announcements ──
  docs.push(
    {
      _id: 'ann-oznanila-oktober-2026',
      _type: 'announcement',
      title: 'Oznanila za oktober 2026',
      slug: slug('oznanila-oktober-2026'),
      category: 'notice',
      importance: 'normal',
      summary: 'Mesečna oznanila s koledarjem svetih maš in nameni ter župnijskimi obvestili za oktober.',
      publishFrom: at('2026-10-01', '00:00'),
      publishUntil: at('2026-10-31', '23:45'),
      showOnHomepage: true,
      attachments: [{_type: 'attachment', _key: key(), title: 'Oznanila – oktober 2026 (PDF)', file: bulletinFiles.get('oktober')}],
    },
    {
      _id: 'ann-roznivenski-mesec-2026',
      _type: 'announcement',
      title: 'Oktober – mesec rožnega venca',
      slug: slug('oktober-mesec-roznega-venca-2026'),
      category: 'pastoral',
      importance: 'important',
      summary: 'Vsak večer pred sveto mašo molimo rožni venec pred izpostavljenim Najsvetejšim.',
      body: blocks(
        'Mesec oktober je zaradi praznika Rožnovenske Matere Božje v celoti posvečen rožnemu vencu. Zato ga bomo v tem mesecu tudi mi vsak večer pred sveto mašo molili pred izpostavljenim Najsvetejšim.',
        'Odkar imamo v Marijini cerkvi na vidnem mestu razstavljen rožni venec z jagodo iz rožnega venca sv. Janeza Pavla II., smo še toliko bolj povabljeni, da s to globoko molitvijo pred Gospoda prinašamo našo župnijo, naše družine in vso Kristusovo Cerkev. Lepo bo, če boste mesec oktober z molitvijo (vsaj desetke) rožnega venca vsak dan obeležili tudi doma.',
      ),
      publishFrom: at('2026-10-01', '00:00'),
      publishUntil: at('2026-10-31', '23:45'),
      showOnHomepage: true,
    },
    {
      _id: 'ann-adoracija',
      _type: 'announcement',
      title: 'Adoracija pred Najsvetejšim',
      slug: slug('adoracija-pred-najsvetejsim'),
      category: 'pastoral',
      importance: 'normal',
      summary: 'Vsak dan razen četrtka in nedelje med 17.00 in 18.00 v Marijini cerkvi.',
      body: blocks(
        'Adoracija pred Najsvetejšim je možna vsak dan razen četrtka in nedelje med 17.00 in 18.00 uro v Marijini cerkvi.',
        'Molitvena skupina se srečuje vsako sredo ob 18.00 v Marijini cerkvi, molitvena skupina Karitas pa se k molitvi za zdravje srečuje ob torkih ob 18.00 ob kipu Kraljice miru.',
      ),
      publishFrom: at('2026-09-01', '00:00'),
      showOnHomepage: true,
    },
    {
      _id: 'ann-romanje-trsat-2026',
      _type: 'announcement',
      title: 'Prijave na župnijsko romanje na Trsat',
      slug: slug('prijave-romanje-trsat-2026'),
      category: 'notice',
      importance: 'normal',
      summary: 'Prijave do 10. oktobra osebno v župnišču, po spletu ali po telefonu. Cena 40 €, otroci do 15. leta brezplačno.',
      body: blocks('Pri kosilu bo na voljo tudi brezmesni meni, vendar je treba na to izbiro pri prijavi posebej opozoriti.'),
      publishFrom: at('2026-10-01', '00:00'),
      publishUntil: at('2026-10-10', '23:45'),
      showOnHomepage: false,
      relatedEvent: ref('event-romanje-trsat-2026'),
    },
    {
      _id: 'ann-vpis-verouk-2026',
      _type: 'announcement',
      title: 'Vpis v veroučno šolo',
      slug: slug('vpis-v-verousko-solo-2026'),
      category: 'catechesis',
      importance: 'important',
      summary: 'Vpis bo v torek, 1., in sredo, 2. septembra, med 16.00 in 18.00 v pevski sobi v župnišču.',
      body: blocks(
        'Starši ste po večini elektronske prijavnice že oddali. Zato bo vpis namenjen temu, da osebno izrečemo nekaj besed, nas opozorite na morebitne posebnosti in poravnate stroške za učbenike, liturgične zvezke in ogrevanje.',
        'Veroučna šola bo svoja vrata odprla v ponedeljek, 7. septembra, katehetska sveta maša pa bo že dan prej, v nedeljo ob 10.00.',
      ),
      publishFrom: at('2026-08-25', '00:00'),
      publishUntil: at('2026-09-07', '23:45'),
      showOnHomepage: false,
      relatedEvent: ref('event-katehetska-masa-2026'),
    },
    {
      _id: 'ann-otroci-nas-potrebujejo-2026',
      _type: 'announcement',
      title: 'Karitas: Otroci nas potrebujejo',
      slug: slug('otroci-nas-potrebujejo-2026'),
      category: 'caritas',
      importance: 'normal',
      summary: 'Slovenska Karitas zbira sredstva za pakete šolskih potrebščin za 14.000 otrok. Dar 5 € s SMS ZVEZEK5 na 1919.',
      body: blocks('Če želite pri akciji sodelovati, lahko pri izhodu iz cerkve poiščete položnico, s pomočjo katere lahko na račun Slovenske Karitas nakažete želeno vsoto.'),
      publishFrom: at('2026-08-01', '00:00'),
      publishUntil: at('2026-09-15', '23:45'),
      showOnHomepage: false,
    },
  )

  // ── Weekly bulletin for the current week ──
  docs.push({
    _id: 'bulletin-2026-10-25',
    _type: 'weeklyBulletin',
    weekStart: '2026-10-25',
    weekEnd: '2026-10-31',
    liturgicalNotes: blocks(
      '30. navadna nedelja: »Kdor se povišuje, bo ponižan.« V sredo, 28. oktobra, praznujemo apostola Simona in Juda Tadeja.',
    ),
    items: [
      {
        _type: 'bulletinItem',
        _key: key(),
        title: 'Rožni venec pred sveto mašo',
        body: blocks('Do konca oktobra vsak večer pred sveto mašo molimo rožni venec pred izpostavljenim Najsvetejšim.'),
      },
      {
        _type: 'bulletinItem',
        _key: key(),
        title: 'Češčenje Svetega Rešnjega Telesa',
        body: blocks('V nedeljo, 25. oktobra, je bilo med 15.00 in 18.30 češčenje v cerkvi Povišanja svetega Križa, sklenjeno s sveto mašo ob 18.30.'),
      },
      {
        _type: 'bulletinItem',
        _key: key(),
        title: 'Adoracija',
        body: blocks('Adoracija pred Najsvetejšim je možna vsak dan razen četrtka in nedelje med 17.00 in 18.00 v Marijini cerkvi.'),
      },
    ],
    events: [ref('event-cescenje-2026')],
    attachments: [{_type: 'attachment', _key: key(), title: 'Oznanila – oktober 2026 (PDF)', file: bulletinFiles.get('oktober')}],
  })

  // ── Sacraments ──
  const askPastor = blocks('Za krst, poroko in spoved se oglasite pri župniku, kjer se boste dogovorili za pripravo in podelitev zakramenta.')
  const sac = (id: string, title: string, kind: string, summary: string, order: number, extra: Record<string, unknown> = {}) => ({
    _id: `sacrament-${id}`,
    _type: 'sacrament',
    title,
    slug: slug(id),
    kind,
    summary,
    order,
    contact: ref(PASTOR),
    contactNote: blocks('Župnijski urad: ponedeljek in petek od 17. do 18. ure, torek od 11. do 12. ure, četrtek od 7.30 do 8.00. Telefon 01 362 11 71 ali 041 604 422.'),
    ...extra,
  })
  docs.push(
    sac('krst', 'Krst', 'baptism', 'Za krst se oglasite pri župniku, kjer se boste dogovorili za pripravo in podelitev zakramenta.', 1, {description: askPastor}),
    sac('prvo-sveto-obhajilo', 'Prvo sveto obhajilo', 'communion', 'Otroci se na prvo sveto obhajilo pripravljajo v 3. razredu verouka.', 2, {
      description: blocks('V veroučnem letu 2025/2026 je k prvemu svetemu obhajilu pristopilo 12 otrok.'),
      downloads: [{...ref(ID.docPrijavnica), _key: key()}],
    }),
    sac('sveta-birma', 'Sveta birma', 'confirmation', 'Birmanci se pripravljajo v 8. in 9. razredu verouka pri župniku.', 3, {
      description: blocks('V veroučnem letu 2025/2026 je zakrament svete birme prejelo 23 mladostnikov.'),
      downloads: [{...ref(ID.docPrijavnica), _key: key()}],
    }),
    sac('poroka', 'Sveta poroka', 'marriage', 'Za poroko se oglasite pri župniku, kjer se boste dogovorili za pripravo in podelitev zakramenta.', 4, {description: askPastor}),
    sac('spoved', 'Sveta spoved', 'confession', 'Za spoved se oglasite pri župniku ali se z njim dogovorite po telefonu.', 5, {description: askPastor}),
    sac('bolnisko-maziljenje', 'Bolniško maziljenje', 'anointing', 'Za obisk bolnika na domu pokličite župnika na 041 604 422.', 6, {
      description: blocks('Priložnost za prejem zakramenta bolniškega maziljenja je tudi vsako leto na srečanju bolnih, invalidnih in ostarelih v naši župniji.'),
    }),
    sac('pogreb', 'Pogreb', 'funeral', 'Svojci se za pogreb in svete maše za pokojnega oglasite v župnijskem uradu ali pokličite župnika.', 7),
  )

  // ── Verouk ──
  const session = (weekday: string, time: string) => ({_type: 'session', _key: key(), weekday, time, location: 'Župnišče'})
  const grades: [number, string, string, string, string][] = [
    [1, '1. razred', 'wednesday', '17:00', CATECHIST],
    [2, '2. razred', 'wednesday', '16:00', CATECHIST],
    [3, '3. razred – priprava na prvo obhajilo', 'tuesday', '17:00', CATECHIST],
    [4, '4. razred', 'tuesday', '16:00', CATECHIST],
    [5, '5. razred', 'tuesday', '14:00', CATECHIST],
    [6, '6. razred', 'tuesday', '15:00', CATECHIST],
    [7, '7. razred', 'wednesday', '15:00', CATECHIST],
    [8, '8. razred – birma', 'monday', '15:00', PASTOR],
    [9, '9. razred – birma', 'monday', '16:00', PASTOR],
  ]
  for (const [grade, title, weekday, time, catechist] of grades) {
    docs.push({
      _id: `catgroup-2025-2026-${grade}`,
      _type: 'catechesisGroup',
      title,
      grade,
      schoolYear: '2025/2026',
      catechist: ref(catechist),
      sessions: [session(weekday, time)],
    })
  }

  // ── Pages ──
  docs.push(
    {
      _id: ID.pageAbout,
      _type: 'page',
      title: 'O župniji',
      slug: slug('o-zupniji'),
      intro: 'Župnija Pirniče leži pod Šmarno goro in povezuje vasi Verje, Zgornje Pirniče, Spodnje Pirniče, Vikrče in Zavrh pod Šmarno goro.',
      sections: [
        {
          _type: 'sectionRichText',
          _key: key(),
          title: 'Mlada župnija',
          body: blocks(
            'Župnija Pirniče je bila ustanovljena leta 1985 na praznik Marijinega vnebovzetja, ko se je zaradi naraščajočega števila prebivalcev izločila iz župnije Smlednik. Spada v dekanijo Ljubljana - Šentvid v nadškofiji Ljubljana.',
            'Prvi župnik Peter Slevec je vodil gradnjo Marijine cerkve v Zgornjih Pirničah, ki je postala središče župnije. Ob njej stojita starejši podružnični cerkvi: cerkev Povišanja svetega Križa v Spodnjih Pirničah in cerkev sv. Tomaža, apostola, v Zgornjih Pirničah. Župnik je msgr. dr. Blaž Jezeršek.',
          ),
        },
        {
          _type: 'sectionTextImage',
          _key: key(),
          title: 'Naše cerkve',
          body: blocks(
            'Nedeljske svete maše so v soboto ob 18.30 in v nedeljo ob 10.00 v Marijini cerkvi ter v nedeljo ob 8.00 v cerkvi svetega Križa.',
            'Med tednom so maše ob ponedeljkih in petkih ob 18.30 v cerkvi svetega Križa, ob torkih, sredah in sobotah ob 18.30 ter ob četrtkih ob 7.00 v Marijini cerkvi.',
          ),
          image: imgTomaz,
          imageSide: 'right',
        },
        {
          _type: 'sectionRichText',
          _key: key(),
          title: 'Življenje župnije',
          body: [
            block('V veroučnem letu 2025/2026 je k verouku hodilo 100 otrok. V župniji delujejo:'),
            ...bullets([
              'župnijski pastoralni svet,',
              'Župnijska Karitas Pirniče,',
              'molitvena skupina in molitvena skupina Karitas,',
              'dve zakonski skupini,',
              'mladinska skupina,',
              'odrasli pevski zbor.',
            ]),
            block('Vsako poletje pripravimo oratorij, jeseni pa župnijsko romanje.'),
          ],
        },
        {
          _type: 'sectionFaq',
          _key: key(),
          title: 'Pogosta vprašanja',
          items: [
            {
              _type: 'faqItem',
              _key: key(),
              question: 'Kako naročim sveto mašo?',
              answer: blocks('V župnijskem uradu v času uradnih ur ali pri župniku po maši.'),
            },
            {
              _type: 'faqItem',
              _key: key(),
              question: 'Kje najdem oznanila?',
              answer: blocks('Mesečna oznanila z nameni svetih maš so na voljo v cerkvi in na tej spletni strani med dokumenti.'),
            },
          ],
        },
      ],
    },
    {
      _id: ID.pagePrivacy,
      _type: 'page',
      title: 'Zasebnost',
      slug: slug('zasebnost'),
      intro: 'Kako spletna stran Župnije Pirniče ravna z vašimi podatki.',
      sections: [
        {
          _type: 'sectionRichText',
          _key: key(),
          body: [
            block('Upravljavec', 'h2'),
            block('Upravljavec osebnih podatkov je Župnija Pirniče, Zgornje Pirniče 74b, 1215 Medvode, e-pošta zupirnice@gmail.com.'),
            block('Piškotki in analitika', 'h2'),
            block('Spletna stran ne uporablja piškotkov za sledenje in ne vključuje orodij za analitiko ali vsebin tretjih oseb.'),
            block('Kontaktni obrazec', 'h2'),
            block('Podatke, ki jih vpišete v kontaktni obrazec (ime, e-pošta, telefon, sporočilo), uporabimo izključno za odgovor na vaše sporočilo. Sporočilo prejme župnijski urad po e-pošti.'),
            block('Mašni nameni', 'h2'),
            block('Na spletni strani objavljamo mašne namene v enaki obliki kot v tiskanih oznanilih. Če ne želite, da je namen objavljen, to povejte ob naročilu maše.'),
            block('Fotografije', 'h2'),
            block('Fotografije otrok z verouka in drugih dejavnosti objavljamo le s soglasjem staršev, ki ga dajo ob vpisu v veroučno šolo. Za odstranitev fotografije nam pišite.'),
          ],
        },
      ],
    },
  )

  console.log(`Zapisujem ${docs.length} dokumentov …`)
  const tx = client.transaction()
  for (const doc of docs) tx.createOrReplace(doc as {_id: string; _type: string})

  tx.patch('catechesisPage', (p) =>
    p
      .set({
        schoolYear: '2025/2026',
        intro: blocks('Verouk v župniji Pirniče poteka v župnišču v Zgornjih Pirničah. V veroučnem letu 2025/2026 ga je obiskovalo 100 otrok od 1. do 9. razreda.'),
        enrollment: blocks(
          'Vpis v veroučno šolo je v začetku septembra v pevski sobi v župnišču. Prijavnico starši večinoma oddate že prej v elektronski obliki, ob vpisu pa poravnate stroške za delovne in liturgične zvezke ter ogrevanje.',
          'Za napredovanje v naslednji razred je potreben reden obisk veroučnih ur (vsaj 75-odstotna udeležba). Podrobnosti so v pravilniku veroučne šole.',
        ),
        notice: blocks('Spodaj je urnik veroučnega leta 2025/2026. Urnik za 2026/2027 bo objavljen, ko ga potrdi župnijski urad.'),
        contact: ref(PASTOR),
        documents: [{...ref(ID.docPrijavnica), _key: key()}],
      }),
  )
  tx.patch('settings', (p) => p.set({privacyPage: ref(ID.pagePrivacy)}))
  tx.patch('homePage', (p) =>
    p.set({
      'welcome.link': {_type: 'link', label: 'Več o župniji', kind: 'internal', internal: ref(ID.pageAbout)},
      featuredLinks: [
        {_type: 'link', _key: key(), label: 'Oznanila za oktober', kind: 'internal', internal: ref('ann-oznanila-oktober-2026')},
        {_type: 'link', _key: key(), label: 'Adoracija in molitvene skupine', kind: 'internal', internal: ref('ann-adoracija')},
      ],
    }),
  )
  await tx.commit()
  console.log('Vsebina je vpisana.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
