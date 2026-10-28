"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteContent, publishContent, saveContent } from "@/app/admin/(app)/vsebina/actions";
import type { RefOption } from "@/app/admin/(app)/vsebina/queries";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { Button } from "@/components/admin/ui";
import { slugify, titleOf, TYPES, type ContentType, type Doc, type Field } from "@/lib/content/fields";
import { FormProvider } from "./context";
import { sameDoc, serverErrorPath, validateDoc, type Errors } from "./doc";
import { FieldList, FieldView } from "./FieldView";
import "./vsebina.css";

export type ContentFormProps = {
  type: ContentType;
  /** null = a new document (not saved yet). */
  id: string | null;
  doc: Doc;
  published: boolean;
  refs: RefOption[];
  /** The public site's origin, for "Odpri na strani". */
  origin: string;
  isOwner: boolean;
  /** The viewer's saves wait for the owner. */
  approval: boolean;
};

const LEAVE = "Sprememb še niste shranili. Res želite oditi?";

/** Groups of the form: the type's Sanity groups, else one untitled group. Top-level objects get their own titled group. */
type Block = { title?: string; help?: string; fields: Field[]; object?: Extract<Field, { kind: "object" }> };
function blocksOf(type: ContentType): Block[] {
  const def = TYPES[type];
  const groups = def.groups ?? [{ name: "", title: "" }];
  const out: Block[] = [];
  for (const g of groups) {
    const fields = def.fields.filter((f) => (def.groups ? f.group === g.name : true));
    let run: Field[] = [];
    let first = true;
    const flush = () => {
      if (run.length) out.push({ title: first ? g.title || undefined : undefined, fields: run });
      if (run.length) first = false;
      run = [];
    };
    for (const f of fields) {
      if (f.kind === "object") {
        flush();
        // A group that is just this object (Iskalniki → seo) keeps the group's name alone.
        const title = !def.groups || !first ? f.label : fields.length === 1 ? g.title : `${g.title} · ${f.label}`;
        out.push({ title, help: f.help, fields: f.fields, object: f });
        first = false;
      } else run.push(f);
    }
    flush();
  }
  return out;
}

/**
 * The generic editor for one website document, rendered from its TypeDef:
 * a sticky bar (state, "Odpri na strani", "Shrani", ⋯ with publish and
 * delete), the title, and the fields as grouped rows. Leaving with unsaved
 * changes asks first; problems show next to their fields.
 */
export function ContentForm({ type, id, doc: initial, published: initialPublished, refs, origin, isOwner, approval }: ContentFormProps) {
  const def = TYPES[type];
  const router = useRouter();
  const toast = useToast();
  const [doc, setDoc] = useState<Doc>(initial);
  const [saved, setSaved] = useState<Doc>(initial);
  const [published, setPublished] = useState(initialPublished);
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, start] = useTransition();
  const isNew = id == null;
  const changed = !sameDoc(doc, saved);
  const dirty = isNew || changed;
  const dirtyRef = useRef(changed);
  useEffect(() => {
    dirtyRef.current = changed;
  }, [changed]);

  // Unsaved-changes guard: closing the tab, and any link inside the app.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      if (!window.confirm(LEAVE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const slugField = def.fields.find((f) => f.kind === "slug");
  const change = useCallback(
    (name: string, v: unknown) => {
      setDoc((d) => {
        const next: Doc = { ...d };
        if (v === undefined) delete next[name];
        else next[name] = v;
        // A new document's address follows its title until someone edits the address.
        if (isNew && slugField?.kind === "slug" && name === slugField.source) {
          const was = (d.slug as { current?: string } | undefined)?.current ?? "";
          if (!was || was === slugify(String(d[name] ?? ""), slugField.max)) {
            const s = slugify(String(v ?? ""), slugField.max);
            if (s) next.slug = { _type: "slug", current: s };
            else delete next.slug;
          }
        }
        return next;
      });
      setErrors((e) => {
        if (!Object.keys(e).some((k) => k === name || k.startsWith(name + "."))) return e;
        return Object.fromEntries(Object.entries(e).filter(([k]) => k !== name && !k.startsWith(name + ".")));
      });
    },
    [isNew, slugField],
  );

  const focusFirst = (errs: Errors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`f-${first}`) ?? document.querySelector<HTMLElement>(`[id^="f-${first}."]`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  function save() {
    if (busy) return;
    setBanner(null);
    const errs = validateDoc(def, doc);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.show({ text: Object.keys(errs).length === 1 ? "Eno polje je treba popraviti." : "Nekaj polj je treba popraviti.", tone: "error" });
      focusFirst(errs);
      return;
    }
    start(async () => {
      const r = await saveContent({ id: id ?? undefined, type, data: doc });
      if (!r.ok) {
        const at = serverErrorPath(def, r.error);
        if (at) {
          setErrors({ [at]: r.error });
          focusFirst({ [at]: r.error });
        } else setBanner(r.error === "forbidden" ? "Tega ne morete urejati." : r.error);
        return;
      }
      setSaved(doc);
      dirtyRef.current = false;
      if (r.data.status === "pending") {
        toast.show("Poslano župniku v potrditev.");
        return;
      }
      toast.show({ text: isNew ? `Dodano: ${titleOf(def, doc)}.` : "Shranjeno. Sprememba je že na strani.", historyId: r.data.historyId });
      if (isNew && r.data.id) router.replace(`/vsebina/${type}/${r.data.id}`);
    });
  }

  // ⌘S / Ctrl+S saves.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function togglePublished() {
    if (!id || busy) return;
    setMenu(false);
    start(async () => {
      const r = await publishContent(id, !published);
      if (!r.ok) return setBanner(r.error === "forbidden" ? "Tega ne morete spremeniti." : r.error);
      if (r.data.status === "pending") return toast.show("Poslano župniku v potrditev.");
      setPublished(!published);
      toast.show({ text: published ? "Skrito s strani." : "Objavljeno na strani.", historyId: r.data.historyId });
    });
  }

  function remove() {
    if (!id || busy) return;
    setMenu(false);
    if (!window.confirm(`Res izbrišem »${titleOf(def, doc)}«? To lahko razveljavite takoj po brisanju.`)) return;
    start(async () => {
      const r = await deleteContent(id);
      if (!r.ok) return setBanner(r.error === "forbidden" ? "Izbriše lahko samo župnik." : r.error);
      dirtyRef.current = false;
      toast.show({ text: `Izbrisano: ${titleOf(def, doc)}.`, historyId: r.data.status === "applied" ? r.data.historyId : null });
      router.replace(`/vsebina/${type}`);
    });
  }

  const blocks = useMemo(() => blocksOf(type), [type]);
  const path = !isNew && published ? def.publicPath?.(saved) : null;
  const title = def.singleton ? def.label : isNew && !String(doc[def.titleField] ?? "").trim() ? def.newLabel : titleOf(def, doc);
  const state = busy ? "Shranjujem …" : dirty ? (isNew ? "Še ni shranjeno" : "Neshranjene spremembe") : approval ? "Shranjeno za potrditev" : "Shranjeno";

  return (
    <FormProvider value={{ errors, refs, isNew }}>
      <div className="vs-bar">
        {def.singleton ? (
          <span className="vs-bar-l" />
        ) : (
          <Link href={`/vsebina/${type}`} className="back">
            <Icon name="l" />
            {def.plural}
          </Link>
        )}
        <div className="vs-bar-r">
          <span className={dirty ? "vs-state dirty" : "vs-state"} aria-live="polite">
            {state}
          </span>
          {path ? (
            <a className="vs-open" href={`${origin}${path}`} target="_blank" rel="noreferrer">
              <Icon name="ext" />
              <span>Odpri na strani</span>
            </a>
          ) : null}
          <Button variant="primary" size="sm" onClick={save} disabled={busy || (!dirty && !isNew)} aria-busy={busy}>
            {approval ? "Pošlji v potrditev" : isNew ? "Dodaj" : "Shrani"}
          </Button>
          {!isNew && !def.singleton ? (
            <div className="vs-more">
              <button type="button" className="iconbtn" aria-label="Več možnosti" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <Icon name="more" />
              </button>
              {menu ? (
                <div className="vs-menu right" role="menu" onKeyDown={(e) => e.key === "Escape" && setMenu(false)}>
                  <button type="button" role="menuitem" onClick={togglePublished}>
                    <Icon name={published ? "ban" : "eye"} />
                    {published ? "Skrij s strani" : "Objavi na strani"}
                  </button>
                  {isOwner ? (
                    <button type="button" role="menuitem" className="danger" onClick={remove}>
                      <Icon name="trash" />
                      Izbriši
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="page enter vs-page">
        <div className="phead">
          <div>
            <h1>{title}</h1>
            <p className="lede">
              {!published && !isNew
                ? "Skrito: ni prikazano na spletni strani."
                : approval
                  ? "Spremembe bodo na strani, ko jih potrdi župnik."
                  : "Kar shranite tu, je takoj na spletni strani."}
            </p>
          </div>
        </div>
        {banner ? (
          <div className="banner alert" role="alert">
            <p>{banner}</p>
          </div>
        ) : null}

        <form
          className="vs-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {blocks.map((b, i) => (
            <section key={i} className="vs-block" aria-label={b.title}>
              {b.title ? <h2 className="vs-gh">{b.title}</h2> : null}
              {b.help ? <p className="vs-gh-help">{b.help}</p> : null}
              <div className="vs-grp">
                {b.object ? (
                  <FieldList
                    fields={b.fields}
                    value={doc[b.object.name] as Record<string, unknown> | undefined}
                    onChange={(v) => change(b.object!.name, v)}
                    path={[b.object.name]}
                    type={b.object.type}
                  />
                ) : (
                  b.fields.map((f) => <FieldView key={f.name} field={f} value={doc[f.name]} onChange={(v) => change(f.name, v)} path={[f.name]} parent={doc} />)
                )}
              </div>
            </section>
          ))}
        </form>
      </div>
    </FormProvider>
  );
}
