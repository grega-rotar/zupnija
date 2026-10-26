import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

// ───────────────────────── Layout ─────────────────────────

type ContainerProps = ComponentProps<"div"> & { width?: "content" | "prose" | "wide" };

/** Horizontal page gutter + max width. 16px gutters on phones, more on larger screens. */
export function Container({ width = "content", className, ...rest }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        width === "content" && "max-w-content",
        width === "prose" && "max-w-prose",
        width === "wide" && "max-w-[88rem]",
        className,
      )}
      {...rest}
    />
  );
}

type SplitProps = { title?: string | null; titleId?: string; titleClassName?: string; className?: string; children: ReactNode };

/**
 * Text block that lines up with the page title: heading in the left third,
 * text in the right two thirds on large screens, stacked on phones.
 * Without a title the text starts at the left edge.
 */
export function Split({ title, titleId, titleClassName, className, children }: SplitProps) {
  return (
    <Container className={cn("lg:grid lg:grid-cols-12 lg:gap-x-12", className)}>
      {title ? (
        <h2 id={titleId} className={cn("mb-5 text-h2 lg:col-span-4 lg:mb-0", titleClassName)}>
          {title}
        </h2>
      ) : null}
      <div className="min-w-0 max-w-prose lg:col-span-8 lg:max-w-3xl">{children}</div>
    </Container>
  );
}

type SectionProps = ComponentProps<"section"> & { tone?: "paper" | "paper-2" | "ink"; tight?: boolean };

/** Vertical rhythm for page sections. */
export function Section({ tone = "paper", tight, className, ...rest }: SectionProps) {
  return (
    <section
      className={cn(
        tight ? "py-14 sm:py-20" : "py-20 sm:py-28",
        tone === "paper-2" && "bg-paper-2",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
      {...rest}
    />
  );
}

type CardProps = { children: ReactNode; className?: string; padded?: boolean; tone?: "paper" | "ink" };

/** Raised surface: a sheet of paper on the stone ground. */
export function Card({ padded = true, tone = "paper", className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border",
        tone === "paper" && "border-stone/80 bg-paper",
        tone === "ink" && "border-paper/10 bg-ink text-paper",
        padded && "p-5 sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ───────────────────────── Headings ─────────────────────────

type SectionHeadingProps = {
  title: string;
  id?: string;
  eyebrow?: string;
  lede?: string;
  action?: { label: string; href: string };
  as?: "h1" | "h2" | "h3";
  className?: string;
};

/** Section title with an optional "see all" action on the same line. */
export function SectionHeading({ title, id, eyebrow, lede, action, as: Tag = "h2", className }: SectionHeadingProps) {
  return (
    <div className={cn("mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-14", className)}>
      <div className="max-w-prose">
        {eyebrow ? <p className="mb-2 text-small text-ink-3">{eyebrow}</p> : null}
        <Tag id={id} className={cn(Tag === "h1" ? "text-h1" : Tag === "h2" ? "text-h2" : "text-h3")}>
          {title}
        </Tag>
        {lede ? <p className="lede mt-4 text-ink-2">{lede}</p> : null}
      </div>
      {action ? <TextLink href={action.href}>{action.label}</TextLink> : null}
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  lede?: string | null;
  eyebrow?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Photograph behind the title (title turns white; a soft gradient keeps it readable). */
  image?: ReactNode;
  /** Short quotation shown under the lede on photo headers. */
  quote?: { text: string; source?: string | null } | null;
};

/**
 * Page title area used by every inner page. Light stone band by default;
 * pass `image` (a `<SanityImage fill />`) for the photographic variant.
 */
export function PageHeader({ title, lede, eyebrow, children, className, image, quote }: PageHeaderProps) {
  if (image) {
    return (
      <header className={cn("relative isolate overflow-hidden bg-ink text-paper", className)}>
        <div className="absolute inset-0 -z-20">{image}</div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(20_28_24/0.75)_0%,rgb(20_28_24/0.45)_50%,rgb(20_28_24/0.2)_100%)]" />
        <Container className="flex min-h-[20rem] flex-col justify-end py-10 sm:min-h-[24rem] sm:py-14 lg:min-h-[26rem]">
          {eyebrow ? <div className="mb-5 text-small text-paper/75 [&_a:hover]:text-paper [&_[aria-current]]:text-paper">{eyebrow}</div> : null}
          <h1 className="max-w-4xl text-display text-paper">{title}</h1>
          {lede ? <p className="mt-4 max-w-prose font-serif text-[clamp(1.25rem,1.05rem+0.9vw,1.75rem)] leading-snug text-paper">{lede}</p> : null}
          {quote?.text ? (
            <blockquote className="mt-6 max-w-md text-paper/85">
              <p className="lede text-[1.0625rem]">{quote.text}</p>
              {quote.source ? <cite className="mt-1 block text-small not-italic text-paper/70">{quote.source}</cite> : null}
            </blockquote>
          ) : null}
          {children}
        </Container>
      </header>
    );
  }
  return (
    <header className={cn("border-b border-stone bg-paper-2", className)}>
      <Container className="py-14 sm:py-20 lg:py-24">
        {eyebrow ? <div className="mb-6 text-small text-ink-3 [&_[aria-current]]:text-ink-2">{eyebrow}</div> : null}
        <span className="mb-7 block h-px w-12 bg-gold" aria-hidden="true" />
        <h1 className="max-w-4xl text-display">{title}</h1>
        {lede ? <p className="lede mt-6 max-w-prose text-ink-2">{lede}</p> : null}
        {children}
      </Container>
    </header>
  );
}

/** Highlighted note (temporary information). Works on light and dark ground. */
export function Notice({ children, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-prose rounded-md border-l-[3px] border-gold px-4 py-3 text-body",
        "bg-gold-soft/70 text-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ───────────────────────── Links & buttons ─────────────────────────

type ButtonProps = {
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "onDark";
  size?: "md" | "lg";
  icon?: IconName;
  className?: string;
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  external?: boolean;
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium tracking-[0.01em] transition-colors duration-200 " +
  "min-h-12 px-6 text-body focus-visible:outline-offset-4 disabled:opacity-60 disabled:pointer-events-none";

const buttonVariants = {
  primary: "bg-moss text-paper hover:bg-moss-deep",
  secondary: "border border-ink/25 bg-transparent text-ink hover:border-ink",
  ghost: "text-moss hover:bg-moss-soft",
  onDark: "bg-paper text-ink hover:bg-paper-2",
};

/** Button or link that looks like a button. Tap target ≥ 44px. */
export function Button({ href, variant = "primary", size = "md", icon, className, children, type = "button", disabled, external }: ButtonProps) {
  const classes = cn(buttonBase, buttonVariants[variant], size === "lg" && "min-h-[3.25rem] px-7 text-lede", className);
  const content = (
    <>
      <span>{children}</span>
      {icon ? <Icon name={icon} size={18} /> : null}
    </>
  );
  if (href) {
    if (external) {
      return (
        <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled}>
      {content}
    </button>
  );
}

/** Inline text link with a small arrow — for "see all" actions. */
export function TextLink({ href, children, className, external }: { href: string; children: ReactNode; className?: string; external?: boolean }) {
  const classes = cn(
    "group inline-flex min-h-11 items-center gap-1.5 text-body font-medium text-moss hover:text-moss-deep",
    className,
  );
  const inner = (
    <>
      <span className="underline decoration-moss/40 underline-offset-4 group-hover:decoration-moss">{children}</span>
      <Icon name={external ? "external" : "arrow-right"} size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" />
    </>
  );
  return external ? (
    <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  );
}

// ───────────────────────── Small pieces ─────────────────────────

type TagProps = { children: ReactNode; tone?: "neutral" | "moss" | "gold" | "alert" | "onDark"; className?: string };

/** Small label: category, status. Never the only carrier of meaning. */
export function Tag({ children, tone = "neutral", className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-meta font-medium tracking-[0.01em]",
        tone === "neutral" && "bg-paper-3 text-ink-2",
        tone === "moss" && "bg-moss-soft text-moss-deep",
        tone === "gold" && "bg-gold-soft text-[#6f5620]",
        tone === "alert" && "bg-alert-soft text-alert",
        tone === "onDark" && "bg-paper-3 text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Icon + text row used for meta lines (place, time, contact). */
export function MetaRow({ icon, children, className }: { icon: IconName; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 text-small text-ink-2", className)}>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-ink-3" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Honest empty state: what is missing and, where useful, what to do. */
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: { label: string; href: string } }) {
  return (
    <div className="rounded-md border border-dashed border-stone-2 bg-paper px-6 py-12 text-center">
      <p className="font-serif text-h3 text-ink">{title}</p>
      {text ? <p className="mx-auto mt-2 max-w-md text-small text-ink-2">{text}</p> : null}
      {action ? (
        <div className="mt-5">
          <TextLink href={action.href}>{action.label}</TextLink>
        </div>
      ) : null}
    </div>
  );
}

/** Breadcrumb trail; the last item is the current page. */
export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Pot" className={cn("text-small", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="opacity-80 hover:underline hover:opacity-100">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              )}
              {!last ? <Icon name="chevron-right" size={14} className="opacity-50" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Definition-style row list for key facts (contact, office hours). */
export function FactList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  const visible = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "");
  if (!visible.length) return null;
  return (
    <dl className={cn("divide-y divide-stone", className)}>
      {visible.map((item) => (
        <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <dt className="text-small text-ink-3">{item.label}</dt>
          <dd className="text-body text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Renders a JSON-LD script tag. */
export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD is data, not markup; escaping "<" prevents script injection.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
