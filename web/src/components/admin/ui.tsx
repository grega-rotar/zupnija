import Link from "next/link";
import { Icon, type IconName } from "./Icon";

/*
 * Small building blocks over the prototype's classes. They hold no state, so
 * server and client components can both use them; pass handlers only from a
 * client component. When markup is easier to copy from the prototype, using
 * the classes directly is just as good.
 */

const cx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

export type ButtonVariant = "default" | "primary" | "ghost" | "danger" | "ghost-danger";
export type ButtonSize = "md" | "lg" | "sm";
type ButtonLook = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: IconName };

function btnClass({ variant = "default", size = "md", block }: ButtonLook, extra?: string) {
  return cx(
    "btn",
    variant === "primary" && "primary",
    (variant === "ghost" || variant === "ghost-danger") && "ghost",
    (variant === "danger" || variant === "ghost-danger") && "danger",
    size !== "md" && size,
    block && "block",
    extra,
  );
}

/** `.btn` with `.primary` / `.ghost` / `.danger`, `.lg` / `.sm`, `.block`, and a leading icon. */
export function Button({ variant, size, block, icon, className, type = "button", children, ...rest }: ButtonLook & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={btnClass({ variant, size, block }, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

/** The same look as a link (host-relative href, e.g. "/oznanila/nalozi"). */
export function ButtonLink({ variant, size, block, icon, className, href, children, ...rest }: ButtonLook & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={btnClass({ variant, size, block }, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

/** `.iconbtn`: a 42 px square icon button. `label` is required (it's the only name). */
export function IconButton({ icon, label, className, type = "button", ...rest }: { icon: IconName; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx("iconbtn", className)} aria-label={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export type PillTone = "moss" | "gold" | "alert" | "line";
/** `.pill`: moss (default), `.gold`, `.alert`, `.line`. */
export function Pill({ tone = "moss", icon, className, children }: { tone?: PillTone; icon?: IconName; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx("pill", tone !== "moss" && tone, className)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

/** `.chip`: a toggle with `aria-pressed`. */
export function Chip({ pressed, icon, className, children, ...rest }: { pressed?: boolean; icon?: IconName } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cx("chip", className)} aria-pressed={pressed} {...rest}>
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
    <div className={cx("chips", className)} role="group" aria-label={label}>
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
  const Tag = as;
  return (
    <Tag className={cx("field", className)}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </Tag>
  );
}

/** The page header: `.phead` with h1, subtitle and an optional action on the right. */
export function PageHead({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="phead">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}
