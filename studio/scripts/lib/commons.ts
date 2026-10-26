import type {SanityClient} from 'sanity'

const UA = 'zupnija-pirnice-seed/1.0 (https://zupnija-pirnice.si)'

let keyCounter = 0
const key = () => `w${(keyCounter++).toString(36)}${Date.now().toString(36).slice(-3)}`

/** fetch() that waits and retries when Wikimedia rate-limits (HTTP 429). */
async function politeFetch(url: URL | string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {headers: {'User-Agent': UA}})
    if (res.status !== 429 || attempt === 5) return res
    await new Promise((resolve) => setTimeout(resolve, 10_000 * (attempt + 1)))
  }
}

/**
 * Returns a function that uploads a Wikimedia Commons file to Sanity and
 * gives back an `imageWithAlt`. Author and licence go into the caption (CC
 * BY / BY-SA require attribution) and into the asset's credit line. Sanity
 * deduplicates identical files, so re-running does not create copies.
 */
export function commonsUploader(client: SanityClient) {
  return async function commons(title: string, alt: string) {
    const api = new URL('https://commons.wikimedia.org/w/api.php')
    api.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '2000',
      titles: `File:${title}`,
    }).toString()
    const page = Object.values((await (await politeFetch(api)).json()).query.pages)[0] as {
      imageinfo?: {thumburl: string; descriptionurl: string; extmetadata: Record<string, {value: string} | undefined>}[]
    }
    const info = page.imageinfo?.[0]
    if (!info) throw new Error(`Commons file not found: ${title}`)
    const author = (info.extmetadata.Artist?.value ?? 'neznan avtor').replace(/<[^>]+>/g, '').trim()
    const license = info.extmetadata.LicenseShortName?.value ?? ''
    const credit = `Foto: ${author}, ${license}, Wikimedia Commons`

    const buffer = Buffer.from(await (await politeFetch(info.thumburl)).arrayBuffer())
    const asset = await client.assets.upload('image', buffer, {
      filename: title,
      title: alt,
      creditLine: credit,
      source: {name: 'wikimedia-commons', id: title, url: info.descriptionurl},
    })
    console.log('  ', title, '—', credit)
    return {_type: 'imageWithAlt', _key: key(), asset: {_type: 'reference', _ref: asset._id}, alt, caption: credit}
  }
}
