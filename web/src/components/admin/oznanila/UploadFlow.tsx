"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { undoHistory } from "@/app/admin/actions";
import {
  bulletinStateAction,
  discardBulletinAction,
  manualBulletinAction,
  publishBulletinAction,
  retryBulletinAction,
  saveBulletinDraftAction,
  uploadBulletinAction,
} from "@/app/admin/(app)/oznanila/actions";
import type { FlowBulletin, FlowPeriod } from "@/app/admin/(app)/oznanila/flow";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { Button, ButtonLink } from "@/components/admin/ui";
import type { ReadableDraft } from "@/lib/bulletin/types";
import { NAM, OBV, periodName, pl, showsInline, SRE } from "./format";
import { ACCEPT_ANY, ACCEPT_PHOTO, takeHandedOff } from "./handoff";
import { Review, type Busy, type Church } from "./Review";
import { SourceColumn, type SourceFile, type SourceMode } from "./Source";
import "./oznanila.css";

const MAX = 20 * 1024 * 1024;
const TOO_BIG = "Datoteka je prevelika (največ 20 MB).";
const BAD_TYPE = "Te vrste datoteke ne znam prebrati.";
const OK_EXT = /\.(jpe?g|png|heic|heif|webp|pdf|xlsx|csv|ods)$/i;
const OK_MIME = /^(image\/(jpeg|png|heic|heif|webp)|application\/pdf|text\/csv|application\/vnd\.(openxmlformats-officedocument\.spreadsheetml\.sheet|oasis\.opendocument\.spreadsheet))$/;

type Stage = "pick" | "reading" | "review" | "error" | "done";
type Done = { sent: boolean; historyId: number | null; intentions: number; notices: number; events: number; skipped: number };

const picksKey = (id: number) => `oznanila-picks-${id}`;
function loadPicks(id: number): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(picksKey(id)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function storePicks(id: number, picks: Record<string, string> | null) {
  try {
    if (picks) localStorage.setItem(picksKey(id), JSON.stringify(picks));
    else localStorage.removeItem(picksKey(id));
  } catch {
    /* private mode: picks just aren't remembered */
  }
}

/** Codes the backend stores in `error`; anything else is the model's own reason. */
const CODES = new Set(["blurry", "invalid_reply", "missing_upload", "ai_busy"]);
function unreadableText(error: string | null, photo: boolean): string {
  const r = (error ?? "").trim();
  if (!r || CODES.has(r) || !/\s/.test(r))
    return photo ? "Imen in ur na tej fotografiji ne preberem zanesljivo. Nič ni spremenjeno." : "V tej datoteki ne najdem oznanil, ki bi jih lahko zanesljivo prebral. Nič ni spremenjeno.";
  return `${r.replace(/[.\s]+$/, "")}. Nič ni spremenjeno.`;
}
const isPhoto = (mime: string | undefined) => !!mime?.startsWith("image/");
/** "Oktober 2026" → "oktober 2026" in running text (a span like "1.–7. november" stays). */
const lower = (title: string) => title.charAt(0).toLowerCase() + title.slice(1);
const isPdf = (mime: string | undefined) => mime === "application/pdf";

export function UploadFlow({ initial, target, churches, approval, busyMessage }: {
  initial: FlowBulletin | null;
  /** The month an upload is for when nothing else says (the missing month). */
  target: FlowPeriod;
  churches: Church[];
  approval: boolean;
  busyMessage: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const photoInput = useRef<HTMLInputElement>(null);
  const anyInput = useRef<HTMLInputElement>(null);

  const [bulletin, setBulletin] = useState<FlowBulletin | null>(initial);
  const [draft, setDraft] = useState<ReadableDraft | null>(initial?.draft ?? null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [editFor, setEditFor] = useState<number | null>(initial?.draft ? initial.id : null);
  const [local, setLocal] = useState<SourceFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [done, setDone] = useState<Done | null>(() =>
    initial?.status === "published" || initial?.status === "pending"
      ? {
          sent: initial.status === "pending",
          historyId: null,
          intentions: initial.draft?.days.reduce((n, d) => n + d.intentions.length, 0) ?? 0,
          notices: initial.draft?.notices.length ?? 0,
          events: initial.draft?.events.filter((e) => e.include).length ?? 0,
          skipped: 0,
        }
      : null,
  );
  const [elapsed, setElapsed] = useState(0);

  const period = draft?.period ?? bulletin?.period ?? target;
  /** "oktober 2026", "1.–7. november": the oznanila format may change, nothing assumes a month. */
  const span = periodName(period);

  // Picks of a draft are remembered in this browser (the draft itself has no place for them).
  // (After hydration: the server render has none.)
  useEffect(() => {
    if (!initial?.draft) return;
    const t = setTimeout(() => setPicks(loadPicks(initial.id)), 0);
    return () => clearTimeout(t);
  }, [initial]);

  /** Take a fresh server state; a new draft resets the editable copy. */
  const adopt = useCallback(
    (b: FlowBulletin) => {
      setBulletin(b);
      if (b.draft && editFor !== b.id) {
        setDraft(b.draft);
        setPicks(loadPicks(b.id));
        setEditFor(b.id);
      }
      if (!b.draft) setEditFor(null);
    },
    [editFor],
  );

  const stage: Stage = done
    ? "done"
    : uploading
      ? "reading"
      : !bulletin
        ? "pick"
        : bulletin.status === "reading"
          ? "reading"
          : bulletin.status === "draft" && draft
            ? "review"
            : bulletin.status === "unreadable" || bulletin.status === "ai_busy"
              ? "error"
              : "done";

  // ── Polling while Claude reads ──
  useEffect(() => {
    if (bulletin?.status !== "reading" || uploading) return;
    const id = bulletin.id;
    let stop = false;
    const t = setInterval(async () => {
      const r = await bulletinStateAction(id).catch(() => null);
      if (stop || !r?.ok) return;
      if (r.data.status !== "reading") adopt(r.data);
    }, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [bulletin?.status, bulletin?.id, uploading, adopt]);

  useEffect(() => {
    if (stage !== "reading") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [stage]);

  // ── Upload ──
  const upload = useCallback(
    async (file: File) => {
      setPickError(null);
      if (file.size > MAX) return setPickError(TOO_BIG);
      if (!OK_MIME.test(file.type) && !OK_EXT.test(file.name)) return setPickError(BAD_TYPE);
      const mime = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/octet-stream");
      const img = showsInline(mime) ? URL.createObjectURL(file) : undefined;
      const pdf = isPdf(mime) ? URL.createObjectURL(file) : undefined;
      setLocal({ name: file.name, mime, size: file.size, img, local: pdf });
      setUploading(true);
      setDone(null);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("periodStart", target.start);
      try {
        const r = await uploadBulletinAction(fd);
        if (!r.ok) {
          setLocal(null);
          return setPickError(r.forbidden ? "Oznanil ne urejate vi." : r.error);
        }
        adopt(r.data);
        window.history.replaceState(null, "", `?id=${r.data.id}`);
      } catch {
        setLocal(null);
        setPickError("Datoteke ni bilo mogoče naložiti. Preverite povezavo in poskusite znova.");
      } finally {
        setUploading(false);
      }
    },
    [target.start, adopt],
  );

  // A file picked on the list or Domov.
  useEffect(() => {
    const t = setTimeout(() => {
      const f = takeHandedOff();
      if (f) void upload(f);
    }, 0);
    return () => clearTimeout(t);
  }, [upload]);

  useEffect(
    () => () => {
      if (local?.img) URL.revokeObjectURL(local.img);
      if (local?.local) URL.revokeObjectURL(local.local);
    },
    [local],
  );

  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void upload(f);
  };

  const manual = async () => {
    setPickError(null);
    const r = await manualBulletinAction(bulletin?.period.start ?? target.start);
    if (!r.ok) return setPickError(r.error);
    setLocal(null);
    adopt(r.data);
    window.history.replaceState(null, "", `?id=${r.data.id}`);
  };
  const retry = async () => {
    if (!bulletin) return;
    setPickError(null);
    const r = await retryBulletinAction(bulletin.id).catch(() => null);
    if (!r) return setPickError("Ni povezave. Poskusite znova.");
    if (!r.ok) return setPickError(r.error);
    adopt(r.data);
  };

  // ── Review actions ──
  const pick = (id: string, v: string) => {
    const next = { ...picks, [id]: v };
    setPicks(next);
    if (bulletin) storePicks(bulletin.id, next);
  };
  /** The draft as saved: empty notices dropped. */
  const draftOut = (): ReadableDraft | null => (draft ? { ...draft, notices: draft.notices.map((n) => ({ ...n, text: n.text.trim() })).filter((n) => n.text) } : null);
  const resolutions = () => {
    if (!draft) return {};
    const flagged = [...draft.days.flatMap((d) => d.intentions), ...draft.events.filter((e) => e.include)].filter((x) => x.flag && picks[x.id]);
    return Object.fromEntries(flagged.map((x) => [x.id, picks[x.id]]));
  };

  const publish = async () => {
    const d = draftOut();
    if (!bulletin || !d) return;
    setBusy("publish");
    const r = await publishBulletinAction(bulletin.id, d, resolutions()).catch(() => null);
    setBusy(null);
    if (!r) return toast.show({ text: "Objava ni uspela. Poskusite znova.", tone: "error" });
    if (!r.ok) return toast.show({ text: r.error, tone: "error" });
    // Picks stay remembered: after "Razveljavi" the draft comes back already checked.
    const o = r.data;
    setDone({ sent: o.status === "pending", historyId: o.status === "applied" ? o.historyId : null, intentions: o.intentions, notices: o.notices, events: o.events, skipped: o.skipped });
    document.getElementById("scroll")?.scrollTo({ top: 0 });
  };
  const save = async () => {
    const d = draftOut();
    if (!bulletin || !d) return;
    setBusy("save");
    const r = await saveBulletinDraftAction(bulletin.id, d).catch(() => null);
    if (!r?.ok) {
      setBusy(null);
      return toast.show({ text: r ? r.error : "Shranjevanje ni uspelo.", tone: "error" });
    }
    toast.show("Osnutek je shranjen. Najdete ga pri Oznanilih.");
    router.push("/oznanila");
  };
  const discard = async () => {
    if (!bulletin) return;
    setBusy("discard");
    const r = await discardBulletinAction(bulletin.id).catch(() => null);
    if (!r?.ok) {
      setBusy(null);
      return toast.show({ text: r ? r.error : "Osnutka ni bilo mogoče zavreči.", tone: "error" });
    }
    storePicks(bulletin.id, null);
    toast.show("Osnutek je zavržen. Nič ni bilo objavljeno.");
    router.push("/oznanila");
  };
  const undo = async () => {
    if (!done?.historyId || !bulletin) return;
    setBusy("publish");
    const r = await undoHistory(done.historyId).catch(() => null);
    if (!r?.ok) {
      setBusy(null);
      return toast.show({ text: r ? r.error : "Razveljavitev ni uspela.", tone: "error" });
    }
    toast.show(r.data.label);
    const s = await bulletinStateAction(bulletin.id);
    setBusy(null);
    if (s.ok) {
      setBulletin(s.data);
      if (s.data.draft) setDraft(s.data.draft);
      setDone(null);
    } else router.push("/oznanila");
  };

  // ── Render ──
  const at = { pick: 0, reading: 1, error: 1, review: 2, done: 3 }[stage];
  const steps = (
    <ol className="steps">
      {["Naloži", "Claude bere", "Preverite", "Objavljeno"].map((s, i) => (
        <li key={s} className={i === at ? "on" : i < at ? "ok" : ""} aria-current={i === at ? "step" : undefined}>
          <span className="n">{i < at ? <Icon name="check" /> : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
  const issue = draft?.period.issue ?? bulletin?.period.issue;
  const head = (
    <>
      <Link href="/oznanila" className="back">
        <Icon name="l" />
        Oznanila
      </Link>
      <div className="phead">
        <div>
          <span className="rule" aria-hidden="true" />
          <h1>{stage === "review" || stage === "done" ? `Oznanila · ${period.title}` : `Naloži oznanila za ${span}`}</h1>
          {(stage === "review" || stage === "done") && issue ? <p className="lede">{issue}</p> : null}
        </div>
      </div>
      {steps}
    </>
  );
  const inputs = (
    <>
      <input ref={photoInput} type="file" accept={ACCEPT_PHOTO} capture="environment" hidden onChange={take} />
      <input ref={anyInput} type="file" accept={ACCEPT_ANY} hidden onChange={take} />
    </>
  );
  const errLine = pickError ? (
    <p className="pickerr" role="alert">
      <Icon name="alert" />
      {pickError}
    </p>
  ) : null;

  const href = bulletin?.upload ? `/oznanila/datoteka/${bulletin.upload.id}` : undefined;
  const source: SourceFile | null = local
    ? { ...local, href }
    : bulletin?.upload
      ? {
          name: bulletin.upload.filename,
          mime: bulletin.upload.mime,
          size: bulletin.upload.size,
          img: showsInline(bulletin.upload.mime) ? href : undefined,
          href,
        }
      : null;
  const srcCol = (mode: SourceMode) => (source ? <SourceColumn file={source} mode={mode} open={srcOpen} onToggle={() => setSrcOpen((o) => !o)} /> : null);

  if (stage === "pick")
    return (
      <div className="page enter" key="pick">
        {head}
        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void upload(f);
          }}
        >
          <span className="big-ic">
            <Icon name="file" />
          </span>
          <h2>Naložite oznanila za {span}</h2>
          <p>Izberite PDF oznanil ali jih fotografirajte. Lahko tudi povlečete datoteko sem. Za katere dni so, Claude prebere iz oznanil samih.</p>
          {errLine}
          <div className="acts">
            <Button variant="primary" size="lg" icon="up" onClick={() => anyInput.current?.click()}>
              Izberi datoteko
            </Button>
            <Button size="lg" icon="cam" onClick={() => photoInput.current?.click()}>
              Fotografiraj
            </Button>
          </div>
          <button type="button" className="addline" onClick={manual}>
            <Icon name="pen" />
            Vpiši ročno
          </button>
        </div>
        <div className="promise">
          <div>
            <b>Nič se ne objavi samo.</b>
            <p>Claude pripravi osnutek vseh dni v oznanilih. Na strani je šele, ko ga potrdite.</p>
          </div>
          <div>
            <b>Negotova mesta so označena.</b>
            <p>Imena, ure in srečanja, ki jih ne prebere zanesljivo, preverite vi.</p>
          </div>
          <div>
            <b>Vedno lahko razveljavite.</b>
            <p>Vsaka objava je v zgodovini in jo lahko umaknete.</p>
          </div>
        </div>
        {inputs}
      </div>
    );

  if (stage === "reading") {
    const photo = isPhoto(source?.mime);
    const found = [`Datoteka: ${source?.name ?? "naložena"}`, "Redni urnik maš je pripravljen"];
    const doing = uploading
      ? "Nalagam datoteko"
      : elapsed < 8
        ? photo
          ? "Berem fotografijo"
          : "Berem koledar mašnih namenov"
        : elapsed < 25
          ? "Berem obvestila in srečanja"
          : "Razporejam namene k mašam po urniku";
    return (
      <div className="page wide enter" key="reading">
        {head}
        <div className="split">
          {srcCol("reading")}
          <div className="reading" aria-live="polite">
            <h2>Claude bere oznanila …</h2>
            <p className="wsum">Daljša oznanila trajajo do minute. Lahko zaprete to okno, osnutek vas bo počakal.</p>
            <ul className="found">
              {(uploading ? [] : found).map((f, i) => (
                <li key={f} style={{ animationDelay: `${0.4 + i * 0.7}s` }}>
                  <Icon name="check" />
                  {f}
                </li>
              ))}
              <li className="w" key={doing} style={{ animationDelay: elapsed < 1 ? "1.8s" : "0s" }}>
                <Icon name="loader" />
                {doing} …
              </li>
            </ul>
            <div className="skel">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        {inputs}
      </div>
    );
  }

  if (stage === "error") {
    const busyErr = bulletin?.status === "ai_busy";
    // ai_busy covers two cases: the pool is full (error "ai_busy", try later) or reading
    // failed on our side (not set up, crashed). Only the first is "busy"; for the second a
    // new file won't help, so lead with typing it in.
    const down = busyErr && bulletin?.error !== "ai_busy";
    const photo = isPhoto(source?.mime);
    const other = bulletin?.other;
    // Not an error: the file is fine, it is just the bulletin of a period that is already here.
    const card = other ? (
      <div className="infocard" role="status">
        <span className="ic">
          <Icon name="file" />
        </span>
        <h2>Ta oznanila so že naložena</h2>
        <p>
          Ta datoteka so oznanila za {lower(other.title)}, ki so že naložena{other.status === "published" ? " in objavljena" : ""}. Nič ni spremenjeno.
        </p>
        {errLine}
        <div className="acts">
          {other.id ? (
            <ButtonLink href={`/oznanila/nalozi?id=${other.id}`} variant="primary" size="lg" icon="eye">
              Odpri oznanila za {lower(other.title)}
            </ButtonLink>
          ) : null}
          <Button size="lg" icon="up" onClick={() => anyInput.current?.click()}>
            Izberi drugo datoteko
          </Button>
          <Button variant="ghost" size="lg" icon="pen" onClick={manual}>
            Vpiši ročno
          </Button>
        </div>
      </div>
    ) : down ? (
      <div className="errcard" role="alert">
        <h2>Samodejno branje ta trenutek ne deluje</h2>
        <p>Napaka je na naši strani, ne pri vaši datoteki. Oznanila vpišite ročno, vse ostalo deluje. Nič ni spremenjeno.</p>
        {errLine}
        <div className="acts">
          <Button variant="primary" size="lg" icon="pen" onClick={manual}>
            Vpiši ročno
          </Button>
          <Button size="lg" icon="r" onClick={retry}>
            Poskusi znova
          </Button>
        </div>
      </div>
    ) : busyErr ? (
      <div className="errcard" role="alert">
        <h2>Claude je zdaj zaseden</h2>
        <p>{busyMessage} Datoteka je shranjena, nič ni spremenjeno.</p>
        {errLine}
        <div className="acts">
          <Button variant="primary" size="lg" icon="r" onClick={retry}>
            Poskusi znova
          </Button>
          <Button variant="ghost" size="lg" icon="pen" onClick={manual}>
            Vpiši ročno
          </Button>
        </div>
      </div>
    ) : (
      <div className="errcard" role="alert">
        <h2>{photo ? "Te fotografije ni mogoče prebrati" : "Te datoteke ni mogoče prebrati"}</h2>
        <p>{unreadableText(bulletin?.error ?? null, photo)}</p>
        {photo ? (
          <ul>
            <li>
              <Icon name="r" />
              Fotografirajte znova pri dnevni svetlobi, list naj leži ravno.
            </li>
            <li>
              <Icon name="r" />
              Telefon držite nad listom, ne pod kotom.
            </li>
            <li>
              <Icon name="r" />
              Če imate oznanila v PDF-ju, izberite raje tega.
            </li>
          </ul>
        ) : (
          <ul>
            <li>
              <Icon name="r" />
              Preverite, da je to datoteka z oznanili (koledar mašnih namenov in obvestila).
            </li>
            <li>
              <Icon name="r" />
              Če imate oznanila v Wordu, jih shranite kot PDF in izberite tega.
            </li>
          </ul>
        )}
        {errLine}
        <div className="acts">
          {photo ? (
            <Button variant="primary" size="lg" icon="cam" onClick={() => photoInput.current?.click()}>
              Fotografiraj znova
            </Button>
          ) : null}
          <Button variant={photo ? "default" : "primary"} size="lg" icon="up" onClick={() => anyInput.current?.click()}>
            Izberi drugo datoteko
          </Button>
          <Button variant="ghost" size="lg" icon="pen" onClick={manual}>
            Vpiši ročno
          </Button>
        </div>
      </div>
    );
    return (
      <div className="page wide enter" key="error">
        {head}
        <div className="split">
          {srcCol("error")}
          {card}
        </div>
        {inputs}
      </div>
    );
  }

  if (stage === "done" && done) {
    const parts = [pl(done.intentions, NAM), pl(done.notices, OBV), ...(done.events ? [pl(done.events, SRE)] : [])];
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} in ${parts[parts.length - 1]}` : parts[0];
    return (
      <div className="page enter" key="done">
        {head}
        <div className="success">
          <span className="seal">
            <Icon name={done.sent ? "send" : "check"} />
          </span>
          <h2>{done.sent ? "Poslano župniku" : `Oznanila za ${span} so objavljena`}</h2>
          <p>
            {done.sent
              ? `Oznanila za ${span} bo pregledal župnik. Ko jih potrdi, bodo na strani.`
              : `Na strani: ${list}.${done.skipped ? ` Že vpisanih (teh nisem podvojil): ${pl(done.skipped, NAM)}.` : ""}${done.historyId ? " Če ste se zmotili, objavo lahko razveljavite." : ""}`}
          </p>
          <div className="acts">
            {done.sent ? null : (
              <ButtonLink href={`/teden?w=${period.start}`} variant="primary" size="lg" icon="cal">
                Poglej namene
              </ButtonLink>
            )}
            <ButtonLink href="/" size="lg">
              Na začetek
            </ButtonLink>
            {done.historyId ? (
              <Button variant="ghost" size="lg" icon="undo" onClick={undo} disabled={busy != null}>
                Razveljavi
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // review
  if (!draft || !bulletin) return null;
  const review = (
    <Review
      draft={draft}
      picks={picks}
      churches={churches}
      masses={bulletin.masses}
      approval={approval}
      busy={busy}
      notice={bulletin.note ? <p>{bulletin.note}</p> : null}
      onDraft={setDraft}
      onPick={pick}
      onPublish={publish}
      onSave={save}
      onDiscard={discard}
    />
  );
  return (
    <div className={`page enter ${source ? "wide" : ""}`} key="review">
      {head}
      {source ? (
        <div className="split">
          {srcCol("review")}
          {review}
        </div>
      ) : (
        review
      )}
      {inputs}
    </div>
  );
}
