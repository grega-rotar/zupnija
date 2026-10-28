"use client";

/*
 * Exercises RichTextField (both variants), ImageField and FileField with real
 * values from the parish dataset. "Brez strežnika" uploads to a blob: URL
 * instead of the uploadMedia server action, for trying the fields while
 * lib/content/media.ts or the /media route are not there yet.
 */
import { useState } from "react";
import { ChipGroup, Switch } from "@/components/admin/ui";
import { FileField } from "@/components/admin/vsebina/fields/FileField";
import { ImageField } from "@/components/admin/vsebina/fields/ImageField";
import { RichTextField } from "@/components/admin/vsebina/fields/RichTextField";
import type { FileValue, ImageValue } from "@/components/admin/vsebina/fields/ImageField.media";
import type { PtBlock } from "@/components/admin/vsebina/fields/RichTextField.schema";
import { defaultUpload, rememberAsset, type Uploader } from "@/components/admin/vsebina/fields/ImageField.upload";

const CDN = "https://cdn.sanity.io";
const IMG = "image-04fb30d344234886b7ad01f1a50d9f02b42ddc52-3840x2634-jpg";
const PDF = "file-92e11eb0fb18d9ebf907d1e55e695021f632d8ce-pdf";
// Shown from Sanity's CDN until the import has filled /media.
rememberAsset(IMG, { url: `${CDN}/images/hnwav9pa/production/04fb30d344234886b7ad01f1a50d9f02b42ddc52-3840x2634.jpg?w=720&auto=format` });
rememberAsset(PDF, { url: `${CDN}/files/hnwav9pa/production/92e11eb0fb18d9ebf907d1e55e695021f632d8ce.pdf`, filename: "prijavnica-verouk-2025-2026.pdf", size: 308137 });

let spanN = 0;
const span = (text: string, marks: string[] = []) => ({ _type: "span", _key: `sp${++spanN}`, text, marks });
const FULL: PtBlock[] = [
  { _type: "block", _key: "b1", style: "h2", markDefs: [], children: [span("Priprava na birmo")] },
  {
    _type: "block",
    _key: "b2",
    style: "normal",
    markDefs: [{ _type: "link", _key: "l1", href: "/verouk" }],
    children: [span("Srečanja za birmance so "), span("vsak drugi petek", ["strong"]), span(" ob 19.00 v župnišču. Več na strani "), span("Verouk", ["l1"]), span(".")],
  },
  { _type: "block", _key: "b3", style: "normal", listItem: "bullet", level: 1, markDefs: [], children: [span("Prinesite "), span("Sveto pismo", ["em"])] },
  { _type: "block", _key: "b4", style: "normal", listItem: "bullet", level: 1, markDefs: [], children: [span("Pridite pravočasno")] },
  { _type: "block", _key: "b5", style: "blockquote", markDefs: [], children: [span("Prejmi Svetega Duha.")] },
  { _type: "imageWithAlt", _key: "i1", asset: { _type: "reference", _ref: IMG }, alt: "Cerkev sv. Križa v Pirničah" },
  { _type: "attachment", _key: "a1", title: "Prijavnica za verouk", file: { _type: "file", asset: { _type: "reference", _ref: PDF } } },
];
const SIMPLE: PtBlock[] = [
  { _type: "block", _key: "s1", style: "normal", markDefs: [], children: [span("Pisarna je odprta "), span("ob torkih", ["strong"]), span(" po večerni maši.")] },
];

/** A local stand-in for uploadMedia: same result shape, blob: URL, id in the Sanity form. */
const fakeUpload: Uploader = async (file) => {
  await new Promise((r) => setTimeout(r, 600));
  const sha = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const url = URL.createObjectURL(file);
  if (file.type.startsWith("image/")) {
    const bmp = await createImageBitmap(file);
    return { id: `image-${sha}-${bmp.width}x${bmp.height}-${ext}`, url, width: bmp.width, height: bmp.height, filename: file.name };
  }
  return { id: `file-${sha}-${ext}`, url, filename: file.name };
};

export function FieldsDemo() {
  const [mode, setMode] = useState<"fake" | "real">("fake");
  const [errors, setErrors] = useState(false);
  const [full, setFull] = useState<PtBlock[]>(FULL);
  const [simple, setSimple] = useState<PtBlock[]>(SIMPLE);
  const [image, setImage] = useState<ImageValue | null>({
    _type: "image",
    asset: { _type: "reference", _ref: IMG },
    alt: "Cerkev sv. Križa v Pirničah",
    hotspot: { _type: "sanity.imageHotspot", x: 0.5, y: 0.4, width: 1, height: 0.8 },
  });
  const [emptyImage, setEmptyImage] = useState<ImageValue | null>(null);
  const [file, setFile] = useState<FileValue | null>({ _type: "file", asset: { _type: "reference", _ref: PDF } });
  const [emptyFile, setEmptyFile] = useState<FileValue | null>(null);
  const upload = mode === "real" ? defaultUpload : fakeUpload;
  const err = (m: string) => (errors ? m : null);

  const rows: [string, string, React.ReactNode][] = [
    ["rt-full", "Besedilo (full)", <RichTextField key="a" id="rt-full" label="Besedilo" variant="full" value={full} onChange={setFull} upload={upload} error={err("Besedilo je obvezno.")} />],
    ["rt-simple", "Kratko besedilo (simple)", <RichTextField key="b" id="rt-simple" label="Kratko besedilo" variant="simple" value={simple} onChange={setSimple} upload={upload} />],
    ["img", "Glavna slika", <ImageField key="c" id="img" label="Glavna slika" value={image} onChange={setImage} upload={upload} error={err("Dodajte opis slike.")} />],
    ["img-empty", "Slika (prazno)", <ImageField key="d" id="img-empty" label="Slika" value={emptyImage} onChange={setEmptyImage} upload={upload} required error={err("Slika je obvezna.")} />],
    ["file", "Datoteka", <FileField key="e" id="file" label="Datoteka" value={file} onChange={setFile} upload={upload} />],
    ["file-empty", "Datoteka (prazno)", <FileField key="f" id="file-empty" label="Datoteka" value={emptyFile} onChange={setEmptyFile} upload={upload} accept=".pdf" error={err("Naložite PDF.")} />],
  ];

  return (
    <main className="devf">
      <style>{CSS}</style>
      <header>
        <p className="eyebrow">Razvoj</p>
        <h1>Polja za vsebino strani</h1>
        <p className="lede">Obogateno besedilo, slika in datoteka, kot jih bo imel obrazec. Desno je vrednost, ki se shrani.</p>
        <div className="devf-ctl">
          <ChipGroup label="Nalaganje" value={mode} onChange={setMode} options={[["fake", "Brez strežnika"], ["real", "uploadMedia"]] as const} />
          <div className="grp devf-sw">
            <Switch label="Prikaži napake" checked={errors} onChange={setErrors} />
          </div>
        </div>
      </header>
      <div className="devf-rows">
        {rows.map(([id, label, control]) => (
          <section className="devf-row" key={id}>
            <label htmlFor={id} className="devf-l">
              {label}
            </label>
            <div className="devf-c">{control}</div>
          </section>
        ))}
      </div>
      <details className="devf-json">
        <summary>Vrednosti (JSON)</summary>
        <pre>{JSON.stringify({ full, simple, image, emptyImage, file, emptyFile }, null, 2)}</pre>
      </details>
    </main>
  );
}

const CSS = `
.devf{height:100dvh;overflow:auto;padding:40px 20px 120px;max-width:1040px;margin:0 auto;display:grid;gap:28px;align-content:start}
.devf h1{font-size:2rem;letter-spacing:-.04em;line-height:1.1;margin-top:4px}
.devf .lede{color:var(--color-ink-3);margin-top:6px}
.devf-ctl{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:16px}
.devf-sw{padding:0 16px}
.devf-rows{display:grid;gap:28px}
.devf-row{display:grid;gap:8px}
.devf-l{font:var(--label);color:var(--color-ink-3);padding-left:2px}
@media (min-width:720px){.devf-row{grid-template-columns:11rem minmax(0,1fr);gap:20px}.devf-l{padding-top:12px;text-align:right}}
.devf-json pre{font-size:12px;line-height:1.45;background:var(--color-surface);border-radius:12px;padding:16px;overflow:auto;max-height:480px;box-shadow:var(--grp-sh)}
.devf-json summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
`;
