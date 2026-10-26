import {deflateSync} from 'node:zlib'

/**
 * Generates a soft, abstract PNG (no text, no faces) so the sample dataset
 * has images to lay out with. Replace with real photographs in the Studio.
 */

type RGB = [number, number, number]

const PALETTES: RGB[][] = [
  [[214, 205, 182], [143, 160, 133], [61, 90, 71]], // fields / moss
  [[226, 220, 205], [169, 132, 78], [92, 74, 46]], // stone / gold
  [[203, 214, 222], [120, 141, 160], [63, 95, 138]], // sky / river
  [[232, 226, 214], [178, 168, 148], [110, 99, 83]], // lime plaster
  [[209, 219, 205], [121, 148, 122], [44, 66, 52]], // linden shade
]

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBytes = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])))
  return Buffer.concat([len, typeBytes, Buffer.from(data), crc])
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Deterministic pseudo-random in [0, 1). */
function rand(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function placeholderPng(width: number, height: number, seed: number): Buffer {
  const palette = PALETTES[seed % PALETTES.length]
  const r = rand(seed * 7919)
  const blobs = Array.from({length: 4}, () => ({
    x: r() * width,
    y: r() * height,
    rad: (0.25 + r() * 0.4) * Math.max(width, height),
    color: palette[Math.floor(r() * palette.length)],
    strength: 0.35 + r() * 0.4,
  }))
  const angle = r() * Math.PI

  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      // base diagonal gradient
      const t = ((x * Math.cos(angle) + y * Math.sin(angle)) / (width + height) + 0.5) % 1
      let c = mix(palette[0], palette[1], Math.min(1, Math.max(0, t)))
      for (const b of blobs) {
        const d = Math.hypot(x - b.x, y - b.y) / b.rad
        if (d < 1) {
          const w = (1 - d * d) * b.strength
          c = mix(c, b.color, w)
        }
      }
      // subtle horizon band
      const horizon = Math.exp(-Math.pow((y - height * 0.62) / (height * 0.05), 2)) * 0.12
      c = mix(c, palette[2], horizon)
      const i = y * stride + 1 + x * 3
      raw[i] = Math.round(c[0])
      raw[i + 1] = Math.round(c[1])
      raw[i + 2] = Math.round(c[2])
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, {level: 9})),
    chunk('IEND', new Uint8Array(0)),
  ])
}

/** A minimal, valid one-page PDF with a line of text — for sample documents. */
export function placeholderPdf(title: string): Buffer {
  const text = title.replace(/[()\\]/g, '')
  const content = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
