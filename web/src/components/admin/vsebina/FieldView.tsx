"use client";

import { isShown, type Field } from "@/lib/content/fields";
import { Row, useFieldError, type FieldProps } from "./context";
import type { Path } from "./doc";
import { ArrayField, ImagesField } from "./fields/ArrayField";
import { BooleanField, GeopointField, SelectField, StringsField } from "./fields/ChoiceFields";
import { DateField } from "./fields/DateField";
import { FileField } from "./fields/FileField";
import { ImageField } from "./fields/ImageField";
import type { FileValue, ImageValue } from "./fields/ImageField.media";
import { ReferenceField } from "./fields/ReferenceField";
import { RichTextField } from "./fields/RichTextField";
import type { PtBlock } from "./fields/RichTextField.schema";
import { SlugField } from "./fields/SlugField";
import { NumberField, StringField, TextField } from "./fields/StringField";

/** One field of any kind: picks its component (components/admin/vsebina/fields). */
export function FieldView(props: FieldProps<Field>) {
  const { field: f } = props;
  switch (f.kind) {
    case "string":
      return <StringField {...props} field={f} />;
    case "text":
      return <TextField {...props} field={f} />;
    case "number":
      return <NumberField {...props} field={f} />;
    case "slug":
      return <SlugField {...props} field={f} />;
    case "date":
    case "datetime":
    case "time":
      return <DateField {...props} field={f} />;
    case "boolean":
      return <BooleanField {...props} field={f} />;
    case "select":
      return <SelectField {...props} field={f} />;
    case "reference":
      return <ReferenceField {...props} field={f} />;
    case "geopoint":
      return <GeopointField {...props} field={f} />;
    case "strings":
      return <StringsField {...props} field={f} />;
    case "object":
      return <ObjectField {...props} field={f} />;
    case "array":
      return <ArrayField {...props} field={f} />;
    case "images":
      return <ImagesField {...props} field={f} />;
    case "image":
      return <ImageRow {...props} field={f} />;
    case "file":
      return <FileRow {...props} field={f} />;
    case "richText":
      return <RichTextRow {...props} field={f} />;
  }
}

/**
 * The fields of one object, as rows. `onChange` gets the whole new object:
 * empty values are dropped, and an object with nothing left becomes
 * undefined (so untouched optional objects are not stored). `type` is
 * stamped as `_type` when the object has content (address, link, seo …).
 */
export function FieldList({ fields, value, onChange, path, type }: {
  fields: Field[];
  value: Record<string, unknown> | undefined;
  onChange: (v: Record<string, unknown> | undefined) => void;
  path: Path;
  type?: string;
}) {
  const setChild = (name: string, v: unknown) => {
    const next: Record<string, unknown> = { ...(value ?? {}) };
    if (v === undefined) delete next[name];
    else next[name] = v;
    const meaningful = Object.keys(next).some((k) => k !== "_type" && k !== "_key");
    if (!meaningful && !next._key) return onChange(undefined);
    if (type && !next._type) next._type = type;
    onChange(next);
  };
  return (
    <>
      {fields.map((f) =>
        isShown(f, value) ? (
          <FieldView key={f.name} field={f} value={value?.[f.name]} onChange={(v) => setChild(f.name, v)} path={[...path, f.name]} parent={value} />
        ) : null,
      )}
    </>
  );
}

/** A nested object inside a group: its label, then its own small group of rows. */
function ObjectField({ field, value, onChange, path }: FieldProps<Extract<Field, { kind: "object" }>>) {
  const { id, error } = useFieldError(path);
  return (
    <Row label={field.label} help={field.help} error={error} errorId={`${id}-err`} tall>
      <div className="vs-sub">
        <FieldList fields={field.fields} value={value as Record<string, unknown> | undefined} onChange={onChange} path={path} type={field.type} />
      </div>
    </Row>
  );
}

function ImageRow({ field, value, onChange, path }: FieldProps<Extract<Field, { kind: "image" }>>) {
  const { id, error } = useFieldError(path);
  return (
    <Row label={field.label} htmlFor={id} help={field.help} tall>
      <ImageField
        id={id}
        label={field.label}
        value={value as ImageValue | undefined}
        onChange={(v) => onChange(v ?? undefined)}
        required={field.required}
        error={error}
        caption={!field.plain}
        type={field.plain ? "image" : "imageWithAlt"}
      />
    </Row>
  );
}

function FileRow({ field, value, onChange, path }: FieldProps<Extract<Field, { kind: "file" }>>) {
  const { id, error } = useFieldError(path);
  return (
    <Row label={field.label} htmlFor={id} help={field.help} tall>
      <FileField id={id} label={field.label} value={value as FileValue | undefined} onChange={(v) => onChange(v ?? undefined)} accept={field.accept} required={field.required} error={error} />
    </Row>
  );
}

function RichTextRow({ field, value, onChange, path }: FieldProps<Extract<Field, { kind: "richText" }>>) {
  const { id, error } = useFieldError(path);
  return (
    <Row label={field.label} htmlFor={id} help={field.help} tall>
      <RichTextField
        id={id}
        label={field.label}
        value={value as PtBlock[] | undefined}
        onChange={(v) => onChange(v.length ? v : undefined)}
        variant={field.variant}
        error={error}
      />
    </Row>
  );
}
