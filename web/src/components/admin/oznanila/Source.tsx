"use client";

import { Icon } from "@/components/admin/Icon";
import { btnClass } from "@/components/admin/ui";
import { fileKind, fileMeta } from "./format";

export type SourceFile = {
  name: string;
  mime: string;
  size: number;
  /** Inline image (object URL or the upload route). */
  img?: string;
  /** The stored original on the private upload route (/oznanila/datoteka/<id>); absent while uploading. */
  href?: string;
  /** A local object URL of a PDF picked in this browser (preview before the upload is stored). */
  local?: string;
};
export type SourceMode = "reading" | "review" | "error";

const isPdf = (f: SourceFile) => f.mime === "application/pdf" || /\.pdf$/i.test(f.name);

/** The uploaded photo, with the scanline while Claude reads. */
function Photo({ file, mode }: { file: SourceFile; mode: SourceMode }) {
  return (
    <div className="sheetpaper photo">
      {mode === "reading" ? <div className="scanline" /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- a private upload, not an optimisable asset */}
      <img src={file.img} alt="Naložena fotografija oznanil" />
    </div>
  );
}

/** A PDF: the browser's own viewer on the private upload route, with a link out as the fallback. */
function Pdf({ file, mode }: { file: SourceFile; mode: SourceMode }) {
  const src = file.href ?? file.local;
  return (
    <div className="pdfview">
      {mode === "reading" ? <div className="scanline" /> : null}
      {src ? (
        <object data={`${src}#view=FitH&navpanes=0`} type="application/pdf" aria-label={`Izvirnik: ${file.name}`}>
          <div className="pdffall">
            <Icon name="file" />
            <p>Brskalnik PDF-ja ne zna pokazati tukaj.</p>
            {file.href ? (
              <a href={file.href} target="_blank" rel="noopener" className={btnClass({ size: "sm" })}>
                Odpri izvirnik
              </a>
            ) : null}
          </div>
        </object>
      ) : null}
    </div>
  );
}

/** A spreadsheet (or a photo the browser can't show, like HEIC): a card with a link to the original. */
function FileCard({ file, mode }: { file: SourceFile; mode: SourceMode }) {
  return (
    <div className="filecard">
      {mode === "reading" ? <div className="scanline" /> : null}
      <span className="fic">
        <Icon name="file" />
      </span>
      <b>{file.name}</b>
      <span>{fileKind(file.mime)}</span>
      {file.href ? (
        <a href={file.href} target="_blank" rel="noopener">
          <Icon name="eye" />
          Odpri izvirnik
        </a>
      ) : null}
    </div>
  );
}

/** The left column: file name and meta, the phone toggle, and the source. */
export function SourceColumn({ file, mode, open, onToggle }: { file: SourceFile; mode: SourceMode; open: boolean; onToggle: () => void }) {
  const pdf = isPdf(file);
  return (
    <div className={`src-col ${open ? "" : "collapsed"} ${pdf ? "pdf" : ""}`}>
      <div className="srcmeta">
        <span>
          <b>{file.name}</b> · {fileMeta(file.mime, file.size)}
        </span>
        <span className="srcacts">
          {pdf && file.href ? (
            <a href={file.href} target="_blank" rel="noopener" className="srclink">
              Odpri izvirnik
            </a>
          ) : null}
          <button type="button" className={btnClass({ variant: "ghost", size: "sm" }, "showsrc")} onClick={onToggle} aria-expanded={open}>
            {open ? "Skrij izvirnik" : "Pokaži izvirnik"}
          </button>
        </span>
      </div>
      <div className="sheetwrap">{file.img ? <Photo file={file} mode={mode} /> : pdf ? <Pdf file={file} mode={mode} /> : <FileCard file={file} mode={mode} />}</div>
    </div>
  );
}
