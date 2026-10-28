"use client";

import { createContext, useContext } from "react";
import type { RefOption } from "@/app/admin/(app)/vsebina/queries";
import { cn } from "@/lib/utils";
import { pathKey, type Errors, type Path } from "./doc";

/** What every field component needs from the form: the errors and the reference choices. */
export type FormCtx = { errors: Errors; refs: RefOption[]; isNew: boolean };
const Ctx = createContext<FormCtx>({ errors: {}, refs: [], isNew: false });
export const FormProvider = Ctx.Provider;
export const useForm = () => useContext(Ctx);

/** Props every field component gets (one component per Field kind, see FieldView). */
export type FieldProps<F> = {
  field: F;
  value: unknown;
  onChange: (value: unknown) => void;
  path: Path;
  /** The object the field sits in (for `when`, slug sources and "after" dates). */
  parent?: Record<string, unknown>;
};

/** The DOM id of a field's main control: "f-sections.2.title". */
export const fieldId = (path: Path) => `f-${pathKey(path)}`;

/** This field's error message, and the aria props for its control. */
export function useFieldError(path: Path) {
  const { errors } = useForm();
  const id = fieldId(path);
  const error = errors[pathKey(path)] ?? null;
  const aria = error ? { "aria-invalid": true as const, "aria-describedby": `${id}-err` } : {};
  return { id, error, aria };
}

/**
 * One row of a grouped form, as in the prototype's editor: the label in a
 * fixed column on the left and the control on the right. `tall` stacks the
 * label over a full-width control (text areas, rich text, images, lists).
 */
export function Row({ label, htmlFor, help, error, errorId, tall, children, className }: {
  label: string;
  htmlFor?: string;
  help?: string;
  error?: string | null;
  errorId?: string;
  tall?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("vs-r", tall && "tall", error && "bad", className)}>
      <Label className="vs-k" {...(htmlFor ? { htmlFor } : {})}>
        {label}
      </Label>
      <div className="vs-c">
        {children}
        {error ? (
          <p className="vs-err" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
        {help ? <p className="vs-help">{help}</p> : null}
      </div>
    </div>
  );
}
