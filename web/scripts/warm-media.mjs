// Makes every image size the public pages ask for, so no visitor waits for a first render
// (docs/TECHNICAL.md §8, "Website content"). The container runs it in the background on every
// start; derivatives already in UPLOAD_DIR/media-cache/ cost a file read each.
//
//   node web/scripts/warm-media.mjs                      # in the container (the server on :3000)
//   WARM_BASE=http://localhost:3000 node scripts/warm-media.mjs
//
// Reads /sitemap.xml, loads each page and requests every /media/images URL in its src and
// srcset attributes, two at a time. Never fails: problems are counted and printed.
const base = (process.env.WARM_BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const local = (u) => base + new URL(u, base).pathname + new URL(u, base).search;

async function text(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// The server may still be starting.
let sitemap = null;
for (let i = 0; i < 60 && !sitemap; i++) {
  sitemap = await text(`${base}/sitemap.xml`).catch(() => null);
  if (!sitemap) await new Promise((r) => setTimeout(r, 2000));
}
if (!sitemap) {
  console.error("warm-media: the site did not answer, nothing warmed");
  process.exit(0);
}

const pages = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => local(m[1])))];
const images = new Set();
for (const page of pages) {
  const html = await text(page).catch(() => "");
  for (const m of html.matchAll(/(?:src|srcSet|srcset)="([^"]+)"/g)) {
    for (const part of m[1].replace(/&amp;/g, "&").split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u.startsWith("/media/images/")) images.add(base + u);
    }
  }
}

const queue = [...images];
let ok = 0;
let failed = 0;
async function worker() {
  for (let u = queue.shift(); u; u = queue.shift()) {
    const res = await fetch(u).catch(() => null);
    if (res?.ok) {
      await res.arrayBuffer();
      ok++;
    } else failed++;
  }
}
const started = Date.now();
await Promise.all([worker(), worker()]);
console.log(`warm-media: ${pages.length} pages, ${ok} image sizes ready${failed ? `, ${failed} failed` : ""} in ${Math.round((Date.now() - started) / 1000)} s`);
