/**
 * Gives every announcement, event, article, group and sacrament from
 * seed-parish-content.ts a photo. Pirniče itself has few free photos, so most
 * are illustrative pictures from Wikimedia Commons (rosary, monstrance,
 * Trsat, organ …) with the author and licence in the caption. Replace them
 * with the parish's own photos in the Studio when there are some.
 *
 *   npx sanity exec scripts/add-content-images.ts --with-user-token
 *
 * Run after seed-parish-content.ts and add-parish-images.ts.
 */
import {getCliClient} from 'sanity/cli'
import {commonsUploader} from './lib/commons'

const client = getCliClient({apiVersion: '2026-09-14'})
const commons = commonsUploader(client)

/** Illustrative photos: Commons file name → Slovenian alt text. */
const PHOTOS = {
  rosary: ['Rosary 2006-01-16.jpg', 'Lesen rožni venec s križem'],
  rosary2: ['2023 Różaniec.jpg', 'Rožni venec'],
  monstrance: ['Monstrance, Holy Cross, അരുളിക്ക.JPG', 'Monštranca z Najsvetejšim'],
  trsat: ['Rijeka-Sanctuaire-Notre-Dame-Trsat-Statue-Jean-Paul-II.jpg', 'Kip sv. Janeza Pavla II. pri svetišču na Trsatu'],
  organ: ['Pipe organs in Saint Martin church, Teharje.jpg', 'Orgle na koru cerkve'],
  organLoft: ['Olimje, interior of the Assumption of Mary parish church, organ loft.jpg', 'Kor z orglami v baročni cerkvi'],
  choir: ['Pevski zbor Lisca 2.jpg', 'Pevski zbor med nastopom'],
  procession: ['Corpus Christi in Łowicz.jpg', 'Telovska procesija'],
  wedding: ['Placing a wedding ring.jpg', 'Nadevanje poročnega prstana'],
  confessional: ['Confessional in Sacro Cuore (Alcamo).jpg', 'Spovednica'],
  font: ['Dobrnič Slovenia - font.jpg', 'Krstni kamen'],
  recorders: ['Recorders made by Jack Darach.jpg', 'Kljunaste flavte'],
  candles: ['Religious candles in the Church of the Nativity, Bethlehem 015 - Aug 2011.jpg', 'Sveče v cerkvi'],
  communion: ['First Holy Communion Celebration.JPG', 'Otroci na prvem svetem obhajilu'],
  confirmation: ['Bishop visits Moody, leads confirmation 130129-F-PO994-080.jpg', 'Škof podeljuje zakrament svete birme'],
  oils: [
    'Manila Archbishop Jose Cardinal Advincula officiates the Chrism Mass at the Manila Cathedral on Maundy Thursday (April 6, 2023).jpg',
    'Blagoslov svetih olj',
  ],
  couple: ['Senior-3336451 1920.jpg', 'Starejši par z roko v roki'],
  campfire: ['Campfire at Webb Lake - YFMP (9268956845).jpg', 'Mladi ob tabornem ognju'],
  nave: ['Saint Martin church interior, Teharje, Slovenia.jpg', 'Notranjost cerkve'],
  nave2: ["2019-11-10 St. Martin's Parish Church (Bled) - nave.jpg", 'Ladja župnijske cerkve'],
} as const

/** Document id → photo. */
const ASSIGN: Record<string, keyof typeof PHOTOS> = {
  'ann-oznanila-oktober-2026': 'nave2',
  'ann-roznivenski-mesec-2026': 'rosary',
  'ann-adoracija': 'monstrance',
  'ann-romanje-trsat-2026': 'trsat',
  'ann-vpis-verouk-2026': 'communion',
  'ann-otroci-nas-potrebujejo-2026': 'candles',

  'event-telovo-2026': 'procession',
  'event-sklep-veroucnega-leta-2026': 'communion',
  'event-oratorij-2026': 'campfire',
  'event-katehetska-masa-2026': 'nave',
  'event-koncert-kd-jakoba-aljaza': 'choir',
  'event-koncert-baroka': 'organLoft',
  'event-koncert-trio-kljunastih-flavt': 'recorders',
  'event-orgelski-koncert-vatikanske-skrivnosti': 'organ',
  'event-srecanje-zakonskih-jubilantov-2026': 'couple',
  'event-romanje-trsat-2026': 'trsat',
  'event-cescenje-2026': 'monstrance',
  'event-seja-zps-2026-11': 'nave2',
  'event-prva-zakonska-skupina-2026-11': 'wedding',
  'event-sodelavci-karitas-2026-11': 'candles',
  'event-druga-zakonska-skupina-2026-11': 'couple',

  'article-roznovenska-mati-bozja': 'rosary2',
  'article-kristofova-nedelja-miva-2026': 'nave',
  'article-sveto-resnje-telo-in-kri': 'procession',

  'group-zps': 'nave2',
  'group-karitas': 'candles',
  'group-molitvena': 'rosary2',
  'group-zakonska-1': 'wedding',
  'group-zakonska-2': 'couple',
  'group-mladinska': 'campfire',
  'group-pevski-zbor': 'choir',

  'sacrament-krst': 'font',
  'sacrament-prvo-sveto-obhajilo': 'communion',
  'sacrament-sveta-birma': 'confirmation',
  'sacrament-poroka': 'wedding',
  'sacrament-spoved': 'confessional',
  'sacrament-bolnisko-maziljenje': 'oils',
  'sacrament-pogreb': 'candles',
}

async function run() {
  const uploaded = new Map<string, Awaited<ReturnType<typeof commons>>>()
  for (const [name, [title, alt]] of Object.entries(PHOTOS)) {
    uploaded.set(name, await commons(title, alt))
  }
  const tx = client.transaction()
  for (const [id, name] of Object.entries(ASSIGN)) {
    const {_key, ...image} = uploaded.get(name)!
    tx.patch(id, (p) => p.set({image}))
  }
  await tx.commit()
  console.log(`Slike dodane na ${Object.keys(ASSIGN).length} dokumentov.`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
