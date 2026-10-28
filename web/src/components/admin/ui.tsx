import Link from "next/link";
import { buttonClassName, Tag } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/*
 * Small building blocks for the editor. Buttons and pills are the public
 * site's own (`buttonClassName` and `Tag` from components/ui/primitives), so
 * the editor and the site cannot drift apart. They hold no state, so server
 * and client components can both use them; pass handlers only from a client
 * component.
 */

export type ButtonVariant = "default" | "primary" | "ghost" | "danger" | "ghost-danger";
export type ButtonSize = "md" | "lg" | "sm";
type ButtonLook = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: IconName };

const SITE_VARIANT = { default: "secondary", primary: "primary", ghost: "ghost", danger: "danger", "ghost-danger": "dangerGhost" } as const;

/**
 * The site's button classes, plus marker classes (`btn`, `primary`, `ghost`,
 * `lg` …) that admin.css uses only to lay buttons out in rows and panels,
 * never for how they look.
 */
export function btnClass({ variant = "default", size = "md", block }: Omit<ButtonLook, "icon"> = {}, extra?: string) {
  return cn(
    // The site's md button is already 48 px; its lg (lede-size type) is for one hero
    // action per page, so the editor's "lg" stays the site's md and only lays out wider.
    buttonClassName({ variant: SITE_VARIANT[variant], size: size === "lg" ? "md" : size }),
    "btn",
    variant === "primary" && "primary",
    (variant === "ghost" || variant === "ghost-danger") && "ghost",
    (variant === "danger" || variant === "ghost-danger") && "danger",
    size !== "md" && size,
    block && "block w-full",
    extra,
  );
}

/** The site's button with a leading icon. */
export function Button({ variant, size, block, icon, className, type = "button", children, ...rest }: ButtonLook & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={btnClass({ variant, size, block }, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

/** The same look as a link (host-relative href, e.g. "/oznanila/nalozi"). */
export function ButtonLink({ variant, size, block, icon, className, href, children, ...rest }: ButtonLook & { href: string } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={btnClass({ variant, size, block }, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

/** A 44 px round icon button. `label` is required (it's the only name). */
export function IconButton({ icon, label, className, type = "button", ...rest }: { icon: IconName; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn("iconbtn", className)} aria-label={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export type PillTone = "moss" | "gold" | "alert" | "line";
const TAG_TONE = { moss: "moss", gold: "gold", alert: "alert", line: "neutral" } as const;

/** The site's `Tag`: moss (default), gold, alert, or neutral (`line`). */
export function Pill({ tone = "moss", icon, className, children }: { tone?: PillTone; icon?: IconName; className?: string; children: React.ReactNode }) {
  return (
    <Tag tone={TAG_TONE[tone]} className={cn("pill gap-1 whitespace-nowrap", className)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Tag>
  );
}

/** `.chip`: a toggle with `aria-pressed`, styled like the site's filter buttons (Oznanila). */
export function Chip({ pressed, icon, className, children, ...rest }: { pressed?: boolean; icon?: IconName } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("chip", className)} aria-pressed={pressed} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

/** `.chips` with one pressed chip (single choice), as a labelled group. */
export function ChipGroup<V extends string>({ label, options, value, onChange, className }: {
  label: string;
  options: ReadonlyArray<readonly [V, React.ReactNode]>;
  value: V | null | undefined;
  onChange: (v: V) => void;
  className?: string;
}) {
  return (
    <div className={cn("chips", className)} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <Chip key={v} pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </Chip>
      ))}
    </div>
  );
}

/** `.switch` row: bold label, optional hint, and the toggle on the right. */
export function Switch({ label, hint, checked, onChange, disabled, name, id }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
}) {
  return (
    <label className="switch">
      <div>
        <b>{label}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
      <input type="checkbox" role="switch" id={id} name={name} checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
    </label>
  );
}

/**
 * `.field`: a label over its control, with an optional hint below. Put the
 * control (input/select/textarea, styled by `.field`) inside as children.
 * Use `as="div"` when the children are a chip group rather than one control.
 */
export function Field({ label, hint, as = "label", className, children }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  as?: "label" | "div";
  className?: string;
  children: React.ReactNode;
}) {
  const El = as;
  return (
    <El className={cn("field", className)}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </El>
  );
}

/**
 * The page header, as the v4 prototype's window title: a bold, tightly
 * tracked title and a small grey lede. `eyebrow` is the small gold label
 * above it (the date on Domov). The `.rule` span is hidden in v4.
 */
export function PageHead({ title, sub, action, eyebrow }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="phead">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <span className="rule" aria-hidden="true" />
        <h1>{title}</h1>
        {sub ? <p className="lede">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}
