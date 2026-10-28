"use client";

/*
 * <ImageField>: one picture in the studio's imageWithAlt shape
 * ({_type:"image", asset:{_type:"reference",_ref}, alt, hotspot?, crop?}).
 * Upload by click or drag and drop, preview, alt text, focal point by clicking
 * on the picture (or the arrow keys), "Odstrani". Controlled: value/onChange.
 */
import { useId, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { hotspotAt, IMAGE_ACCEPT, imageSize, withImage, type ImageValue } from "./ImageField.media";
import { useFileDrop } from "./ImageField.drop";
import { defaultUpload, knownAsset, uploadChecked, type Uploader } from "./ImageField.upload";
import "./ImageField.css";

export type ImageFieldProps = {
  /** Put on the main control, for an outside `<label htmlFor>`. */
  id?: string;
  label: string;
  value: ImageValue | null | undefined;
  onChange: (value: ImageValue | null) => void;
  required?: boolean;
  error?: string | null;
  /** Also edit a caption (images inside rich text). */
  caption?: boolean;
  /** `_type` for a new value; an existing value keeps its own. */
  type?: string;
  /** Defaults to the `uploadMedia` server action. */
  upload?: Uploader;
};

/** A smaller derivative from our /media route; blob: and other URLs as they are. */
export function previewSrc(url: string | undefined, width: number): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/media/images/") ? `${url}?w=${width}&auto=format` : url;
}

const STEP = 0.05;

export function ImageField({ id, label, value, onChange, required, error, caption, type = "image", upload = defaultUpload }: ImageFieldProps) {
  const uid = useId();
  const baseId = id ?? uid;
  const errId = `${baseId}-err`;
  const hintId = `${baseId}-hint`;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const shownError = failed ?? error ?? null;
  const ref = value?.asset?._ref;
  const asset = knownAsset(ref);
  const size = imageSize(ref);

  async function take(file: File) {
    setFailed(null);
    setBusy(true);
    try {
      const res = await uploadChecked(upload, file, "image");
      onChange(withImage(value, res, type));
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Nalaganje ni uspelo.");
    } finally {
      setBusy(false);
    }
  }

  const { over, dropProps, inputProps, pick } = useFileDrop(take, busy);
  const set = (patch: Partial<ImageValue>) => value && onChange({ ...value, ...patch });

  const spot = value?.hotspot;
  const setSpot = (x: number, y: number) => set({ hotspot: hotspotAt(x, y) });
  const clearSpot = () => {
    if (!value) return;
    const { hotspot: _drop, ...rest } = value;
    void _drop;
    onChange(rest);
  };

  function onStageClick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setSpot((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }

  function onStageKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const d = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[e.key];
    if (d) {
      e.preventDefault();
      setSpot((spot?.x ?? 0.5) + d[0], (spot?.y ?? 0.5) + d[1]);
    } else if (e.key === "Home" || e.key === "Escape") {
      if (spot) {
        e.preventDefault();
        clearSpot();
      }
    }
  }

  const errorLine = shownError ? (
    <p className="mf-err" id={errId} role="alert">
      <Icon name="alert" />
      {shownError}
    </p>
  ) : null;

  if (!value?.asset?._ref) {
    return (
      <div className="mf" {...dropProps}>
        <button
          type="button"
          id={baseId}
          className={cn("mf-drop", over && "over", shownError && "invalid")}
          onClick={pick}
          disabled={busy}
          aria-label={`${label}: naložite sliko${required ? " (obvezno)" : ""}`}
          aria-describedby={shownError ? errId : undefined}
        >
          <span className="mf-tile" aria-hidden="true">
            <Icon name={busy ? "loader" : "cam"} className={busy ? "mf-spin" : undefined} />
          </span>
          <span className="mf-drop-t">
            <b>{busy ? "Nalagam sliko …" : over ? "Spustite sliko tukaj" : "Izberite sliko"}</b>
            <small>{busy ? "Trenutek." : "ali jo povlecite sem · JPG, PNG, WebP do 20 MB"}</small>
          </span>
        </button>
        <input {...inputProps} accept={IMAGE_ACCEPT} />
        {errorLine}
      </div>
    );
  }

  const ratio = size ? `${size.width} / ${size.height}` : undefined;
  return (
    <div className={cn("mf mf-img", over && "over")} {...dropProps} aria-busy={busy || undefined}>
      <div className="mf-media">
        <div
          className="mf-stage"
          style={{ aspectRatio: ratio }}
          role="group"
          tabIndex={0}
          aria-label={`${label}: žarišče slike`}
          aria-describedby={hintId}
          onClick={onStageClick}
          onKeyDown={onStageKey}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- our own /media route or a local preview */}
          <img src={previewSrc(asset.url, 720)} alt={value.alt || ""} draggable={false} />
          {spot ? (
            <span className="mf-spot" style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }} aria-hidden="true" />
          ) : null}
          {busy ? (
            <span className="mf-busy">
              <Icon name="loader" className="mf-spin" /> Nalagam …
            </span>
          ) : null}
        </div>
        <p className="mf-hint" id={hintId}>
          {spot
            ? `Žarišče: ${Math.round(spot.x * 100)} % od leve, ${Math.round(spot.y * 100)} % od vrha. Ko se slika obreže, ostane ta del.`
            : "Kliknite na najpomembnejši del slike (žarišče), da ostane viden, ko se slika obreže."}
        </p>
      </div>

      <div className="mf-side">
        <label className="field">
          <span>Opis slike</span>
          <input
            id={baseId}
            type="text"
            value={value.alt ?? ""}
            maxLength={300}
            placeholder="npr. Cerkev sv. Križa v Pirničah"
            onChange={(e) => set({ alt: e.target.value })}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? errId : undefined}
          />
          <small>Kaj je na sliki. Pomaga slepim in iskalnikom.</small>
        </label>
        {caption ? (
          <label className="field">
            <span>Podnapis</span>
            <input type="text" value={value.caption ?? ""} placeholder="Neobvezno" onChange={(e) => set({ caption: e.target.value })} />
          </label>
        ) : null}
        <div className="mf-acts">
          <Button size="sm" icon="up" onClick={pick} disabled={busy}>
            Zamenjaj
          </Button>
          {spot ? (
            <Button size="sm" variant="ghost" icon="undo" onClick={() => clearSpot()}>
              Brez žarišča
            </Button>
          ) : null}
          <Button size="sm" variant="ghost-danger" icon="trash" onClick={() => onChange(null)} disabled={busy}>
            Odstrani
          </Button>
        </div>
        {errorLine}
      </div>
      <input {...inputProps} accept={IMAGE_ACCEPT} />
    </div>
  );
}
