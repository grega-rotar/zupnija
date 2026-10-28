"use client";

import { Icon } from "@/components/admin/Icon";
import { btnClass } from "@/components/admin/ui";
import type { ReadableDraft } from "@/lib/bulletin/types";
import { fileMeta, fSheetDay, fSpan, fT, pre } from "./format";

export type SourceFile = { name: string; mime: string; size: number; /** Inline image (object URL or the upload endpoint). */ img?: string; /** Link to the original. */ href?: string };
export type SourceMode = "reading" | "review" | "error";

/** The uploaded photo, with the scanline while Claude reads. */
function Photo({ file, mode }: { file: SourceFile; mode: SourceMode }) {
  return (
    <div className="sheetpaper photo">
      {mode === "reading" ? <div className="scanline" /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- a private upload, not an optimisable asset */}
      <img src={file.img} alt="Naložena fotografija" />
    </div>
  );
}

/** A PDF or spreadsheet: a card with a link to the original. */
function FileCard({ file, mode }: { file: SourceFile; mode: SourceMode }) {
  const pdf = file.mime === "application/pdf";
  return (
    <div className="filecard">
      {mode === "reading" ? <div className="scanline" /> : null}
      <span className="fic">
        <Icon name="file" />
      </span>
      <b>{file.name}</b>
      <span>{pdf ? "PDF" : file.mime.startsWith("image/") ? "Fotografija" : "Tabela"}</span>
      {file.href ? (
        <a href={file.href} target="_blank" rel="noopener">
          <Icon name="eye" />
          Odpri izvirnik
        </a>
      ) : null}
    </div>
  );
}

/** "pon 2.11. 18.30 …" or "torek, 3. 11., 18.30 …" → the day part and the rest. */
const SPLIT = /^((?:pon|tor|sre|čet|pet|sob|ned)[a-zčšž]*\.?,?\s+\d{1,2}\.\s?\d{1,2}\.?,?)\s+(.*)$/i;

/**
 * Without a photo: the draft written out as the sheet (each item's source
 * line), with the numbered gold marks on the flagged lines.
 */
function Transcript({ draft, picks, week }: { draft: ReadableDraft; picks: Record<string, string>; week: string }) {
  let n = 0;
  const title = `Oznanila ${fSpan(week)}`;
  return (
    <div className="sheetpaper" role="img" aria-label="Prepis lista z oznanili">
      <p className="t">{title}</p>
      <ol>
        {draft.items.map((it) => {
          const line = it.sourceLine?.trim() || `${fSheetDay(it.date)} ${fT(it.time)} ${pre(it.kind) === "†" ? "† " : ""}${it.text}`;
          const m = line.match(SPLIT);
          const badge = it.flag ? ++n : 0;
          return (
            <li key={it.id} className={it.flag ? `hl ${picks[it.id] ? "ok" : ""}` : undefined}>
              {badge ? <span className="badge">{badge}</span> : null}
              <span className="pd">{m ? m[1] : ""}</span>
              {m ? m[2] : line}
            </li>
          );
        })}
      </ol>
      {draft.notices.length ? (
        <ol className="ann">
          {draft.notices.map((t, i) => (
            <li key={i}>– {t}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** The left column: file name and meta, the phone toggle, and the source. */
export function SourceColumn({ file, mode, open, onToggle, draft, picks, week }: {
  file: SourceFile;
  mode: SourceMode;
  open: boolean;
  onToggle: () => void;
  draft?: ReadableDraft | null;
  picks?: Record<string, string>;
  week: string;
}) {
  const transcript = !file.img && mode === "review" && draft && draft.items.length > 0;
  return (
    <div className={`src-col ${open ? "" : "collapsed"}`}>
      <div className="srcmeta">
        <span>
          <b>{file.name}</b> · {fileMeta(file.mime, file.size)}
        </span>
        <button type="button" className={btnClass({ variant: "ghost", size: "sm" }, "showsrc")} onClick={onToggle} aria-expanded={open}>
          {open ? "Skrij izvirnik" : "Pokaži izvirnik"}
        </button>
      </div>
      <div className="sheetwrap">
        {file.img ? <Photo file={file} mode={mode} /> : <FileCard file={file} mode={mode} />}
        {transcript ? (
          <>
            <p className="prepis">Prepis, kot ga je prebral Claude:</p>
            <Transcript draft={draft} picks={picks ?? {}} week={week} />
          </>
        ) : null}
      </div>
    </div>
  );
}
