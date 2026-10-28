"use client";

/*
 * <FileField>: one file in the studio's shape ({_type:"file", asset:{_type:
 * "reference",_ref}}). Upload by click or drag and drop; shows the name and
 * size; "Odstrani". Controlled: value/onChange.
 */
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { Button } from "@/components/admin/ui";
import { cn, formatFileSize } from "@/lib/utils";
import { extension, FILE_ACCEPT, fileValue, type FileValue } from "./ImageField.media";
import { useFileDrop } from "./ImageField.drop";
import { defaultUpload, knownAsset, rememberAsset, uploadChecked, type Uploader } from "./ImageField.upload";
import "./ImageField.css";

export type FileFieldProps = {
  id?: string;
  label: string;
  value: FileValue | null | undefined;
  onChange: (value: FileValue | null) => void;
  /** e.g. ".pdf,.docx"; defaults to the studio's attachment list. */
  accept?: string;
  required?: boolean;
  error?: string | null;
  upload?: Uploader;
  /** Called with the original file name after an upload (rich text uses it as the attachment title). */
  onUploaded?: (filename: string) => void;
};

/** "Oznanila_november.pdf" from `Content-Disposition`, if the route sends one. */
function dispositionName(h: string | null): string | null {
  if (!h) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(h);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(h);
  return plain ? plain[1] : null;
}

/** Name and size of an asset we did not upload in this tab: one HEAD request. */
function useAssetInfo(id: string | undefined) {
  const [info, setInfo] = useState(() => knownAsset(id));
  const [prevId, setPrevId] = useState(id);
  if (prevId !== id) {
    setPrevId(id);
    setInfo(knownAsset(id));
  }
  useEffect(() => {
    if (!id) return;
    const k = knownAsset(id);
    if (!k.url || (k.size && k.filename)) return;
    let gone = false;
    fetch(`${k.url}?dl=`, { method: "HEAD" })
      .then((r) => {
        if (!r.ok || gone) return;
        const size = Number(r.headers.get("content-length")) || null;
        const filename = dispositionName(r.headers.get("content-disposition"));
        rememberAsset(id, { size: k.size ?? size, filename: k.filename ?? filename });
        setInfo(knownAsset(id));
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [id]);
  return info;
}

export function FileField({ id, label, value, onChange, accept = FILE_ACCEPT, required, error, upload = defaultUpload, onUploaded }: FileFieldProps) {
  const uid = useId();
  const baseId = id ?? uid;
  const errId = `${baseId}-err`;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const ref = value?.asset?._ref;
  const info = useAssetInfo(ref);
  const shownError = failed ?? error ?? null;

  async function take(file: File) {
    setFailed(null);
    setBusy(true);
    try {
      const res = await uploadChecked(upload, file, "file", accept);
      onChange(fileValue(res, value?._key));
      onUploaded?.(res.filename || file.name);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Nalaganje ni uspelo.");
    } finally {
      setBusy(false);
    }
  }

  const { over, dropProps, inputProps, pick } = useFileDrop(take, busy);
  const errorLine = shownError ? (
    <p className="mf-err" id={errId} role="alert">
      <Icon name="alert" />
      {shownError}
    </p>
  ) : null;
  const types = accept.replaceAll(".", "").toUpperCase().split(",").slice(0, 4).join(", ");

  if (!ref) {
    return (
      <div className="mf" {...dropProps}>
        <button
          type="button"
          id={baseId}
          className={cn("mf-drop mf-drop-row", over && "over", shownError && "invalid")}
          onClick={pick}
          disabled={busy}
          aria-label={`${label}: naložite datoteko${required ? " (obvezno)" : ""}`}
          aria-describedby={shownError ? errId : undefined}
        >
          <span className="mf-tile" aria-hidden="true">
            <Icon name={busy ? "loader" : "up"} className={busy ? "mf-spin" : undefined} />
          </span>
          <span className="mf-drop-t">
            <b>{busy ? "Nalagam datoteko …" : over ? "Spustite datoteko tukaj" : "Izberite datoteko"}</b>
            <small>{busy ? "Trenutek." : `ali jo povlecite sem · ${types} do 20 MB`}</small>
          </span>
        </button>
        <input {...inputProps} accept={accept} />
        {errorLine}
      </div>
    );
  }

  const ext = extension(info.filename) ?? extension(ref);
  const meta = [ext, formatFileSize(info.size)].filter(Boolean).join(" · ");
  const name = info.filename || (ext ? `Datoteka ${ext}` : "Datoteka");
  return (
    <div className="mf" {...dropProps}>
      <div className={cn("mf-file", over && "over")} aria-busy={busy || undefined}>
        <span className="mf-tile mf-tile-doc" aria-hidden="true">
          <Icon name={busy ? "loader" : "file"} className={busy ? "mf-spin" : undefined} />
        </span>
        <span className="mf-file-t">
          {info.url ? (
            <a href={info.url} target="_blank" rel="noopener noreferrer" id={baseId} title="Odpri v novem zavihku">
              {busy ? "Nalagam …" : name}
            </a>
          ) : (
            <b id={baseId}>{name}</b>
          )}
          {meta ? <small>{meta}</small> : null}
        </span>
        <span className="mf-file-acts">
          <Button size="sm" icon="up" onClick={pick} disabled={busy} aria-label={`Zamenjaj datoteko ${name}`}>
            <span className="mf-wide">Zamenjaj</span>
          </Button>
          <Button size="sm" variant="ghost-danger" icon="trash" onClick={() => onChange(null)} disabled={busy} aria-label={`Odstrani datoteko ${name}`}>
            <span className="mf-wide">Odstrani</span>
          </Button>
        </span>
      </div>
      <input {...inputProps} accept={accept} />
      {errorLine}
    </div>
  );
}
