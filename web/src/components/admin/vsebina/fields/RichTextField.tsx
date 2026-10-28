"use client";

/*
 * <RichTextField value onChange variant>: Portable Text, edited with
 * @portabletext/editor, stored exactly as the studio stored it (blockContent /
 * simpleBlockContent; rules in RichTextField.schema.ts). The public RichText
 * renderer (components/sanity/RichText.tsx) renders the output unchanged.
 *
 * - Toolbar: full = B, I, link, H2, H3, quote, both lists, picture,
 *   attachment; simple = B, I, link, bullet list. One tab stop, arrow keys
 *   move along it (WAI-ARIA toolbar). Ctrl/⌘+B, +I, +K.
 * - Links are edited in a small popover under the toolbar.
 * - Pictures and attachments upload through the same uploader as
 *   ImageField / FileField; "Uredi" opens their fields under the text.
 * - Paste from Word, Google Docs or the web keeps only what the variant allows.
 */
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  defineAnnotation,
  defineBlockObject,
  defineDecorator,
  defineTextBlock,
  EditorProvider,
  PortableTextEditable,
  useEditor,
  useEditorSelector,
  type BlockObjectRenderProps,
  type Editor,
  type PortableTextBlock,
  type TextBlockRenderProps,
} from "@portabletext/editor";
import { BehaviorPlugin, EventListenerPlugin, NodePlugin } from "@portabletext/editor/plugins";
import { defineBehavior, forward, type Behavior } from "@portabletext/editor/behaviors";
import {
  getActiveAnnotations,
  getFocusTextBlock,
  isActiveDecorator,
  isActiveListItem,
  isActiveStyle,
  isSelectionCollapsed,
} from "@portabletext/editor/selectors";
import { Icon } from "@/components/admin/Icon";
import { Button } from "@/components/admin/ui";
import { cn, formatFileSize } from "@/lib/utils";
import { FileField } from "./FileField";
import { ImageField, previewSrc } from "./ImageField";
import { extension, FILE_ACCEPT, IMAGE_ACCEPT, type FileValue, type ImageValue } from "./ImageField.media";
import { defaultUpload, knownAsset, uploadChecked, type Uploader } from "./ImageField.upload";
import {
  cleanHref,
  isEmptyPortableText,
  newKey,
  preparePastedHtml,
  sanitizePortableText,
  SCHEMAS,
  type PtBlock,
  type RichTextVariant,
} from "./RichTextField.schema";
import "./ImageField.css";
import "./RichTextField.css";

export type RichTextFieldProps = {
  /** Put on the editable area, for an outside `<label htmlFor>`. */
  id?: string;
  label: string;
  value: PtBlock[] | null | undefined;
  /** Gets `[]` when the text is empty. */
  onChange: (value: PtBlock[]) => void;
  variant: RichTextVariant;
  error?: string | null;
  placeholder?: string;
  upload?: Uploader;
};

/* ── Paste: the editor's HTML importer, then our rules ── */

const pasteBehaviors = (variant: RichTextVariant): Behavior[] => [
  defineBehavior({
    on: "deserialize.data",
    guard: ({ event }) => {
      if (event.mimeType !== "text/html") return false;
      const data = preparePastedHtml(event.data, variant);
      return data === event.data ? false : { data };
    },
    actions: [({ event }, { data }) => [forward({ ...event, data })]],
  }),
  defineBehavior({
    on: "deserialization.success",
    guard: ({ event }) => {
      const data = sanitizePortableText(event.data, variant) as PortableTextBlock[];
      return JSON.stringify(data) === JSON.stringify(event.data) ? false : { data };
    },
    actions: [({ event }, { data }) => [forward({ ...event, data })]],
  }),
];
const BEHAVIORS: Record<RichTextVariant, Behavior[]> = { full: pasteBehaviors("full"), simple: pasteBehaviors("simple") };

/* ── How the text looks while editing (close to the site's .prose) ── */

type FieldCtx = { editing: string | null; setEditing: (key: string | null) => void };
const Ctx = createContext<FieldCtx>({ editing: null, setEditing: () => {} });

function TextBlockView({ attributes, children, node }: TextBlockRenderProps) {
  const a = attributes as React.HTMLAttributes<HTMLElement>;
  if (node.listItem) {
    return (
      <div {...a} className="rt-li" data-list={node.listItem} data-level={node.level ?? 1}>
        {children}
      </div>
    );
  }
  if (node.style === "h2") return <h2 {...a}>{children}</h2>;
  if (node.style === "h3") return <h3 {...a}>{children}</h3>;
  if (node.style === "blockquote") return <blockquote {...a}>{children}</blockquote>;
  return <p {...a}>{children}</p>;
}

function ObjectView({ attributes, children, node, selected }: BlockObjectRenderProps) {
  const { editing, setEditing } = useContext(Ctx);
  const isImage = node._type === "imageWithAlt";
  const img = node as unknown as ImageValue;
  const file = (node as { file?: FileValue }).file;
  const info = knownAsset(isImage ? img.asset?._ref : file?.asset?._ref);
  const title = isImage ? img.caption || img.alt || "Slika brez opisa" : (node as { title?: string }).title || "Priponka brez naslova";
  const meta = isImage
    ? img.alt
      ? img.caption
        ? img.alt
        : "Opis slike"
      : "Manjka opis slike"
    : [extension(info.filename) ?? extension(file?.asset?._ref), formatFileSize(info.size)].filter(Boolean).join(" · ") || "Datoteka";
  const open = editing === node._key;
  return (
    <div {...(attributes as React.HTMLAttributes<HTMLDivElement>)} className={cn("rt-obj", (selected || open) && "on")}>
      {children}
      <div className="rt-card" contentEditable={false}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own /media route
          <img src={previewSrc(info.url, 240)} alt="" className="rt-thumb" draggable={false} />
        ) : (
          <span className="mf-tile mf-tile-doc" aria-hidden="true">
            <Icon name="file" />
          </span>
        )}
        <span className="rt-card-t">
          <b>{title}</b>
          <small className={cn(isImage && !img.alt && "warn")}>{meta}</small>
        </span>
        <Button size="sm" variant="ghost" icon="pen" aria-expanded={open} onClick={() => setEditing(open ? null : node._key)}>
          Uredi
        </Button>
      </div>
    </div>
  );
}

const NODES = [
  defineTextBlock({ type: "block", render: (p) => <TextBlockView {...p} /> }),
  defineDecorator({ type: "strong", render: ({ children }) => <strong>{children}</strong> }),
  defineDecorator({ type: "em", render: ({ children }) => <em>{children}</em> }),
  defineAnnotation({
    type: "link",
    render: ({ annotation, children }) => (
      <span className="rt-a" title={(annotation as { href?: string }).href}>
        {children}
      </span>
    ),
  }),
  defineBlockObject({ type: "imageWithAlt", render: (p) => <ObjectView {...p} /> }),
  defineBlockObject({ type: "attachment", render: (p) => <ObjectView {...p} /> }),
];

/* ── The field ── */

const noop = () => () => {};

export function RichTextField({ id, label, value, onChange, variant, error, placeholder, upload = defaultUpload }: RichTextFieldProps) {
  const uid = useId();
  const baseId = id ?? uid;
  // The editor owns its value after mounting; outside changes reach it through Sync.
  const [initial] = useState(() => sanitizePortableText(value, variant) as PortableTextBlock[]);
  const [editing, setEditing] = useState<string | null>(null);
  const ctx = useMemo(() => ({ editing, setEditing }), [editing]);
  // The editor cannot render on the server; until hydration show a still field of the same size.
  const client = useSyncExternalStore(noop, () => true, () => false);

  if (!client) {
    return (
      <div className="rt" aria-busy="true">
        <div className="rt-bar" aria-hidden="true">
          <span className="rt-btn" />
        </div>
        <div className="rt-text" id={baseId} aria-label={label} />
      </div>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <EditorProvider initialConfig={{ schemaDefinition: SCHEMAS[variant], initialValue: initial.length ? initial : undefined, keyGenerator: newKey }}>
        <Body
          id={baseId}
          label={label}
          value={value}
          onChange={onChange}
          variant={variant}
          error={error}
          placeholder={placeholder}
          upload={upload}
          editing={editing}
          setEditing={setEditing}
        />
      </EditorProvider>
    </Ctx.Provider>
  );
}

type BodyProps = Omit<RichTextFieldProps, "id"> & { id: string; editing: string | null; setEditing: (k: string | null) => void; upload: Uploader };

function Body({ id, label, value, onChange, variant, error, placeholder, upload, editing, setEditing }: BodyProps) {
  const editor = useEditor();
  const errId = `${id}-err`;
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState<null | "image" | "file">(null);
  const [failed, setFailed] = useState<string | null>(null);
  const lastSent = useRef<unknown>(value);
  const shownError = failed ?? error ?? null;

  // Outside value changes (undo in the form, a reset after save) → the editor.
  useEffect(() => {
    if (value === lastSent.current) return;
    lastSent.current = value;
    editor.send({ type: "update value", value: (value ?? []) as PortableTextBlock[] });
  }, [value, editor]);

  async function insertUpload(file: File, kind: "image" | "file") {
    setFailed(null);
    setBusy(kind);
    try {
      const res = await uploadChecked(upload, file, kind, kind === "file" ? FILE_ACCEPT : undefined);
      const key = newKey();
      const asset = { _type: "reference", _ref: res.id };
      const block =
        kind === "image"
          ? { _type: "imageWithAlt", _key: key, asset }
          : { _type: "attachment", _key: key, title: (res.filename || file.name).replace(/\.[^.]+$/, ""), file: { _type: "file", asset } };
      editor.send({ type: "insert.block", block, placement: "auto", select: "none" });
      setEditing(key);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Nalaganje ni uspelo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={cn("rt", shownError && "invalid")}
      onKeyDownCapture={(e) => {
        // Ctrl/⌘+K in the text: the link popover (the browser would focus its address bar).
        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k" && (e.target as HTMLElement).closest(".rt-text")) {
          e.preventDefault();
          e.stopPropagation();
          setLinkOpen(true);
        }
      }}
    >
      <EventListenerPlugin
        on={(event) => {
          if (event.type !== "mutation") return;
          const next = isEmptyPortableText(event.value) ? [] : ((event.value ?? []) as PtBlock[]);
          lastSent.current = next;
          onChange(next);
        }}
      />
      <NodePlugin nodes={NODES} />
      <BehaviorPlugin behaviors={BEHAVIORS[variant]} />

      <Toolbar variant={variant} label={label} busy={busy} onLink={() => setLinkOpen(true)} onPick={insertUpload} />
      {linkOpen ? <LinkPopover onClose={() => setLinkOpen(false)} /> : null}

      <PortableTextEditable
        id={id}
        className="rt-text"
        aria-label={label}
        aria-multiline
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? errId : undefined}
        hotkeys={{
          marks: { "mod+b": "strong", "mod+i": "em" },
        }}
        renderPlaceholder={() => <span className="rt-ph">{placeholder ?? (variant === "full" ? "Začnite pisati …" : "Kratko besedilo …")}</span>}
      />

      {editing ? <ObjectEditor blockKey={editing} upload={upload} onClose={() => setEditing(null)} /> : null}
      {shownError ? (
        <p className="mf-err rt-err" id={errId} role="alert">
          <Icon name="alert" />
          {shownError}
        </p>
      ) : null}
    </div>
  );
}

/* ── Toolbar ── */

type Tool = { key: string; label: string; short?: string; glyph: React.ReactNode; active?: (e: Editor) => boolean; run: () => void };

function Toolbar({ variant, label, busy, onLink, onPick }: {
  variant: RichTextVariant;
  label: string;
  busy: null | "image" | "file";
  onLink: () => void;
  onPick: (file: File, kind: "image" | "file") => void;
}) {
  const editor = useEditor();
  const imageInput = useId();
  const fileInput = useId();
  const [focusIdx, setFocusIdx] = useState(0);
  const click = (inputId: string) => document.getElementById(inputId)?.click();

  const strong = useEditorSelector(editor, isActiveDecorator("strong"));
  const em = useEditorSelector(editor, isActiveDecorator("em"));
  const link = useEditorSelector(editor, (s) => getActiveAnnotations(s).some((a) => a._type === "link"));
  const h2 = useEditorSelector(editor, isActiveStyle("h2"));
  const h3 = useEditorSelector(editor, isActiveStyle("h3"));
  const quote = useEditorSelector(editor, isActiveStyle("blockquote"));
  const bullet = useEditorSelector(editor, isActiveListItem("bullet"));
  const number = useEditorSelector(editor, isActiveListItem("number"));

  const send = (ev: Parameters<Editor["send"]>[0]) => {
    editor.send(ev);
    editor.send({ type: "focus" });
  };
  const B = <b className="rt-g">B</b>;
  const I = <i className="rt-g rt-gi">I</i>;

  const groups: { key: string; tools: (Tool & { on?: boolean })[] }[] = [
    {
      key: "marks",
      tools: [
        { key: "strong", label: "Krepko", short: "Ctrl+B", glyph: B, on: strong, run: () => send({ type: "decorator.toggle", decorator: "strong" }) },
        { key: "em", label: "Ležeče", short: "Ctrl+I", glyph: I, on: em, run: () => send({ type: "decorator.toggle", decorator: "em" }) },
        { key: "link", label: "Povezava", short: "Ctrl+K", glyph: <LinkGlyph />, on: link, run: onLink },
      ],
    },
    ...(variant === "full"
      ? [
          {
            key: "styles",
            tools: [
              { key: "h2", label: "Naslov", glyph: <span className="rt-g rt-gs">H2</span>, on: h2, run: () => send({ type: "style.toggle", style: "h2" }) },
              { key: "h3", label: "Podnaslov", glyph: <span className="rt-g rt-gs">H3</span>, on: h3, run: () => send({ type: "style.toggle", style: "h3" }) },
              { key: "quote", label: "Citat", glyph: <QuoteGlyph />, on: quote, run: () => send({ type: "style.toggle", style: "blockquote" }) },
            ],
          },
        ]
      : []),
    {
      key: "lists",
      tools: [
        { key: "bullet", label: "Seznam", glyph: <BulletGlyph />, on: bullet, run: () => send({ type: "list item.toggle", listItem: "bullet" }) },
        ...(variant === "full"
          ? [{ key: "number", label: "Oštevilčen seznam", glyph: <NumberGlyph />, on: number, run: () => send({ type: "list item.toggle", listItem: "number" }) }]
          : []),
      ],
    },
    ...(variant === "full"
      ? [
          {
            key: "objects",
            tools: [
              { key: "image", label: busy === "image" ? "Nalagam sliko …" : "Slika", glyph: <Icon name={busy === "image" ? "loader" : "cam"} className={busy === "image" ? "mf-spin" : undefined} />, run: () => click(imageInput) },
              { key: "file", label: busy === "file" ? "Nalagam priponko …" : "Priponka", glyph: <Icon name={busy === "file" ? "loader" : "file"} className={busy === "file" ? "mf-spin" : undefined} />, run: () => click(fileInput) },
            ],
          },
        ]
      : []),
  ];
  const flat = groups.flatMap((g) => g.tools);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const n = flat.length;
    const next = { ArrowRight: focusIdx + 1, ArrowLeft: focusIdx - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const i = (next + n) % n;
    setFocusIdx(i);
    e.currentTarget.querySelectorAll<HTMLButtonElement>("button")[i]?.focus();
  }

  let idx = -1;
  return (
    <div className="rt-bar" role="toolbar" aria-label={`Oblikovanje: ${label}`} onKeyDown={onKeyDown}>
      {groups.map((g) => (
        <div className="rt-grp" key={g.key}>
          {g.tools.map((t) => {
            idx += 1;
            const i = idx;
            const toggles = t.key !== "image" && t.key !== "file";
            return (
              <button
                key={t.key}
                type="button"
                className="rt-btn"
                tabIndex={i === focusIdx ? 0 : -1}
                aria-label={t.label}
                aria-pressed={toggles ? !!t.on : undefined}
                aria-haspopup={t.key === "link" ? "dialog" : undefined}
                title={t.short ? `${t.label} (${t.short})` : t.label}
                disabled={!toggles && busy !== null}
                // Keep the text selection: the editor must not lose focus on press.
                onMouseDown={(e) => e.preventDefault()}
                onFocus={() => setFocusIdx(i)}
                onClick={t.run}
              >
                {t.glyph}
              </button>
            );
          })}
        </div>
      ))}
      {variant === "full" ? (
        <>
          <input id={imageInput} type="file" hidden tabIndex={-1} accept={IMAGE_ACCEPT} onChange={(e) => pickFrom(e, "image", onPick)} />
          <input id={fileInput} type="file" hidden tabIndex={-1} accept={FILE_ACCEPT} onChange={(e) => pickFrom(e, "file", onPick)} />
        </>
      ) : null}
    </div>
  );
}

function pickFrom(e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "file", onPick: (f: File, k: "image" | "file") => void) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (file) onPick(file, kind);
}

/* ── Link popover ── */

function LinkPopover({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const inputId = useId();
  // What the link applies to, fixed when the popover opens.
  const [target] = useState(() => {
    const snap = editor.getSnapshot();
    const active = getActiveAnnotations(snap).find((a) => a._type === "link") as { _key: string; href?: string } | undefined;
    return {
      selection: snap.context.selection,
      collapsed: isSelectionCollapsed(snap),
      blockKey: getFocusTextBlock(snap)?.node._key,
      link: active,
    };
  });
  const [href, setHref] = useState(target.link?.href ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLFormElement>(null);
  const canAdd = !!target.selection && (!target.collapsed || !!target.link);

  const close = () => {
    onClose();
    editor.send({ type: "focus" });
  };

  // A click outside closes it, like any popover.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [onClose]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanHref(href);
    if (!clean) {
      setProblem("Vnesite celoten naslov, npr. https://www.primer.si, /novice ali mailto:ime@primer.si.");
      return;
    }
    if (target.link && target.blockKey) {
      editor.send({ type: "annotation.set", at: [{ _key: target.blockKey }, "markDefs", { _key: target.link._key }], props: { href: clean } });
    } else if (target.selection) {
      editor.send({ type: "annotation.add", annotation: { name: "link", value: { href: clean } }, at: target.selection });
    }
    close();
  }

  function remove() {
    if (target.selection) editor.send({ type: "annotation.remove", annotation: { name: "link" }, at: target.selection });
    close();
  }

  return (
    <form
      ref={box}
      className="rt-pop"
      role="dialog"
      aria-label="Povezava"
      onSubmit={apply}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
    >
      {canAdd ? (
        <>
          <label className="field" htmlFor={inputId}>
            <span>{target.link ? "Uredi povezavo" : "Spletni naslov povezave"}</span>
          </label>
          <div className="rt-pop-row">
            <input
              id={inputId}
              className="input"
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              // The popover opens on purpose (button or Ctrl+K): straight to typing.
              autoFocus
              value={href}
              placeholder="https://… ali /stran"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${inputId}-p` : undefined}
              onChange={(e) => {
                setHref(e.target.value);
                setProblem(null);
              }}
            />
            <Button type="submit" size="sm" variant="primary">
              {target.link ? "Shrani" : "Dodaj"}
            </Button>
          </div>
          {problem ? (
            <p className="mf-err" id={`${inputId}-p`}>
              <Icon name="alert" />
              {problem}
            </p>
          ) : null}
          <div className="rt-pop-acts">
            {target.link ? (
              <Button size="sm" variant="ghost-danger" icon="ban" onClick={remove}>
                Odstrani povezavo
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={close}>
              Prekliči
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="rt-pop-msg">Najprej označite besedilo, ki naj postane povezava.</p>
          <div className="rt-pop-acts">
            <Button size="sm" variant="ghost" onClick={close} autoFocus>
              V redu
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

/* ── Picture and attachment fields, under the text ── */

function ObjectEditor({ blockKey, upload, onClose }: { blockKey: string; upload: Uploader; onClose: () => void }) {
  const editor = useEditor();
  const block = useEditorSelector(editor, (s) => s.context.value.find((b) => b._key === blockKey));
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  // Opening it moves focus in, so keyboard users land on the new fields.
  useEffect(() => {
    ref.current?.focus();
  }, [blockKey]);

  if (!block) return null;
  const at = [{ _key: blockKey }];
  const done = () => {
    onClose();
    editor.send({ type: "focus" });
  };
  const del = () => {
    editor.send({ type: "delete.block", at });
    onClose();
  };
  const update = (next: Record<string, unknown>, fields: string[]) => {
    const unset = fields.filter((f) => next[f] === undefined || next[f] === "");
    const props = Object.fromEntries(fields.filter((f) => !unset.includes(f)).map((f) => [f, next[f]]));
    if (Object.keys(props).length) editor.send({ type: "block.set", at, props });
    if (unset.length) editor.send({ type: "block.unset", at, props: unset });
  };

  const isImage = block._type === "imageWithAlt";
  return (
    <div
      className="rt-objed"
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          done();
        }
      }}
    >
      <div className="rt-objed-h">
        <h3 id={titleId}>{isImage ? "Slika v besedilu" : "Priponka v besedilu"}</h3>
        <Button size="sm" variant="primary" icon="check" onClick={done}>
          Končano
        </Button>
      </div>
      {isImage ? (
        <ImageField
          label="Slika v besedilu"
          caption
          type="imageWithAlt"
          upload={upload}
          value={block as unknown as ImageValue}
          onChange={(v) => (v ? update(v as unknown as Record<string, unknown>, ["asset", "alt", "caption", "hotspot", "crop"]) : del())}
        />
      ) : (
        <div className="rt-objed-f">
          <label className="field">
            <span>Naslov priponke</span>
            <input
              type="text"
              value={String((block as { title?: string }).title ?? "")}
              placeholder="npr. Prijavnica za verouk"
              onChange={(e) => editor.send({ type: "block.set", at, props: { title: e.target.value } })}
            />
          </label>
          <FileField
            label="Datoteka priponke"
            upload={upload}
            value={(block as { file?: FileValue }).file}
            onChange={(v) => (v ? editor.send({ type: "block.set", at, props: { file: v } }) : editor.send({ type: "block.unset", at, props: ["file"] }))}
            onUploaded={(name) => {
              if (!(block as { title?: string }).title) editor.send({ type: "block.set", at, props: { title: name.replace(/\.[^.]+$/, "") } });
            }}
          />
          <div className="mf-acts">
            <Button size="sm" variant="ghost-danger" icon="trash" onClick={del}>
              Odstrani priponko
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Glyphs the editor's icon set does not have (same stroke as .i) ── */

const svg = (d: string) => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: d }} />
);
const LinkGlyph = () => svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>');
const QuoteGlyph = () => svg('<path d="M4 7h6v6c0 3-2 4.5-4 5M14 7h6v6c0 3-2 4.5-4 5"/>');
const BulletGlyph = () => svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/>');
const NumberGlyph = () => svg('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5l1.5-1v5M3.5 14.5c.3-.9 2.5-1.1 2.5.3 0 1-2.5 2-2.5 3.2h2.6"/>');
