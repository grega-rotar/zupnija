/**
 * Uploads freely licensed photos from Wikimedia Commons and attaches them to
 * the churches and the home page. Author and licence go into the caption (CC
 * BY / BY-SA require attribution) and into the asset's credit line.
 *
 *   npx sanity exec scripts/add-parish-images.ts --with-user-token
 *
 * Run after seed-parish-data.ts. No free photo of the pastor exists; ask the
 * parish for one and add it in the Studio.
 */
import {getCliClient} from 'sanity/cli'
import {commonsUploader} from './lib/commons'

const client = getCliClient({apiVersion: '2026-09-14'})
const commons = commonsUploader(client)

let keyCounter = 0
const key = () => `k${(keyCounter++).toString(36)}${Date.now().toString(36).slice(-3)}`

async function run() {
  const kriz = await commons('Spodnje Pirnice, Holy Cross church 01.jpg', 'Cerkev Povišanja svetega Križa v Spodnjih Pirničah')
  const krizView = await commons('Spodnje Pirniče 2024.jpg', 'Spodnje Pirniče s cerkvijo svetega Križa na vzpetini')
  const tomaz = await commons(
    "Zgornje Pirnice, St. Thomas' filial church.jpg",
    'Cerkev sv. Tomaža v Zgornjih Pirničah, levo za njo okrogla Marijina cerkev',
  )
  const zgornje = await commons('Zgornje Pirniče 02.jpg', 'Zgornje Pirniče z Marijino cerkvijo in zvonikom cerkve sv. Tomaža')
  const zgornjeFields = await commons('Zgornje Pirniče 01.jpg', 'Polja pred Zgornjimi Pirničami')
  const kriz2 = await commons('Spodnje Pirnice, Holy Cross church 02.jpg', 'Cerkev Povišanja svetega Križa v Spodnjih Pirničah')

  // Page headers keep their tagline and quote; only the image is replaced.
  const header = (name: string, image: Awaited<ReturnType<typeof commons>>) => {
    const {_key, ...rest} = image
    return {[`${name}.image`]: rest}
  }

  await client
    .transaction()
    .patch('church-sv-kriz', (p) => p.set({image: kriz, gallery: [{...krizView, _key: key()}]}))
    .patch('church-sv-tomaz', (p) => p.set({image: tomaz}))
    .patch('church-marijino-vnebovzetje', (p) => p.set({image: zgornje, gallery: [{...tomaz, _key: key()}]}))
    .patch('homePage', (p) =>
      p.set({
        heroImage: (({_key, ...rest}) => rest)(zgornje),
        'welcome.image': (({_key, ...rest}) => rest)(tomaz),
        'tile.image': (({_key, ...rest}) => rest)(zgornjeFields),
        'welcome.text': [
          {
            _type: 'block',
            _key: key(),
            style: 'normal',
            markDefs: [],
            children: [
              {
                _type: 'span',
                _key: key(),
                marks: [],
                text: 'Župnija Pirniče je bila ustanovljena leta 1985 in povezuje vasi Verje, Zgornje Pirniče, Spodnje Pirniče, Vikrče in Zavrh pod Šmarno goro. Svete maše so v Marijini cerkvi v Zgornjih Pirničah in v cerkvi svetega Križa v Spodnjih Pirničah.',
              },
            ],
          },
        ],
      }),
    )
    .patch('settings', (p) =>
      p.set({
        ...header('massesHeader', kriz),
        ...header('announcementsHeader', tomaz),
        ...header('eventsHeader', krizView),
        ...header('parishHeader', zgornje),
        ...header('catechesisHeader', zgornjeFields),
        ...header('contactHeader', kriz2),
      }),
    )
    .commit()
  console.log('Slike so dodane.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
