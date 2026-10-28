import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

// ───────────────────────── Layout ─────────────────────────

/**
 * The tile material of design v4: white, 28px radius, a hairline plus a very
 * soft shadow, on the near-white page. `tileHover` adds the tiny lift for
 * tiles that are links.
 */
export const tile = "rounded-lg bg-surface shadow-soft";
export const tileHover =
  "transition-[transform,box-shadow] duration-500 ease-out-soft hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none";

type ContainerProps = ComponentProps<"div"> & { width?: "content" | "prose" | "wide" };

/** Horizontal page gutter (24px) + max width (1240px, as the prototype's `.wrap`). */
export function Container({ width = "content", className, ...rest }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6",
        width === "content" && "max-w-content",
        width === "prose" && "max-w-[calc(var(--container-prose)+3rem)]",
        width === "wide" && "max-w-[88rem]",
        className,
      )}
      {...rest}
    />
  );
}

type SplitProps = { title?: string | null; titleId?: string; titleClassName?: string; className?: string; children: ReactNode };

/**
 * Text block under a centered heading: the v4 opening above one readable
 * column, centered on the page. Without a title only the column shows.
 */
export function Split({ title, titleId, titleClassName, className, children }: SplitProps) {
  return (
    <Container className={className}>
      {title ? (
        <h2 id={titleId} className={cn("mx-auto mb-10 max-w-3xl text-center lg:mb-14", headline.h2, titleClassName)}>
          {title}
        </h2>
      ) : null}
      <div className="mx-auto min-w-0 max-w-3xl">{children}</div>
    </Container>
  );
}

type SectionProps = ComponentProps<"section"> & { tone?: "paper" | "paper-2" | "ink"; tight?: boolean };

/**
 * Vertical rhythm for page sections: two neighbours sit 160px apart on
 * desktop and 96px on phones (half of it each), as in the prototype.
 * Sections share the one near-white ground; `paper-2` is a sunk band for
 * the rare block that must stand apart.
 */
export function Section({ tone = "paper", tight, className, ...rest }: SectionProps) {
  return (
    <section
      className={cn(
        tight ? "py-10 lg:py-14" : "py-12 lg:py-20",
        tone === "paper-2" && "bg-paper-2",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
      {...rest}
    />
  );
}

type CardProps = { children: ReactNode; className?: string; padded?: boolean; tone?: "paper" | "ink" };

/** Raised surface: a white tile on the near-white page. */
export function Card({ padded = true, tone = "paper", className, children }: CardProps) {
  return (
    <div
      className={cn(
        tone === "paper" && tile,
        tone === "ink" && "rounded-lg bg-ink text-paper",
        padded && "p-6 sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ───────────────────────── Headings ─────────────────────────

/**
 * A headline with its one Instrument Serif italic phrase: `phrase` is set in
 * `.accent` where it occurs in `text`. Without a match the text stays plain.
 */
export function Accented({ text, phrase }: { text: string; phrase?: string | null }) {
  const at = phrase ? text.lastIndexOf(phrase) : -1;
  if (!phrase || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="accent">{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  );
}

/** Headline sizes of v4: `h2` is the prototype's section `.h2`, `display` the page title. */
export const headline = {
  display: "text-[clamp(2.75rem,1.4rem+5.4vw,5.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em]",
  h2: "text-[clamp(2.25rem,1.6rem+2.8vw,3.5rem)] font-bold leading-none tracking-[-0.045em]",
  h3: "text-[1.5rem] font-bold leading-[1.15] tracking-[-0.035em]",
};

type SectionHeadingProps = {
  title: string;
  /** The phrase of `title` set in the serif italic. */
  accent?: string;
  id?: string;
  eyebrow?: string;
  lede?: string;
  action?: { label: string; href: string };
  as?: "h1" | "h2" | "h3";
  /** `start` for headings inside a column; sections open centered. */
  align?: "center" | "start";
  className?: string;
};

/**
 * The v4 section opening: a small gold eyebrow, the headline with one
 * serif italic phrase, a calm subline and an optional "see all" link,
 * centered, 56px above the content (40px on phones).
 */
export function SectionHeading({ title, accent, id, eyebrow, lede, action, as: Tag = "h2", align = "center", className }: SectionHeadingProps) {
  const center = align === "center";
  return (
    <div className={cn("mb-10 flex flex-col lg:mb-14", center ? "mx-auto max-w-3xl items-center text-center" : "items-start", className)}>
      {eyebrow ? <p className="eyebrow mb-3.5">{eyebrow}</p> : null}
      <Tag id={id} className={cn(Tag === "h3" ? headline.h3 : headline.h2)}>
        <Accented text={title} phrase={accent} />
      </Tag>
      {lede ? <p className={cn("lede mt-4 max-w-[40rem] text-balance lg:mt-5", center && "mx-auto")}>{lede}</p> : null}
      {action ? <TextLink href={action.href} className="mt-3 lg:mt-4">{action.label}</TextLink> : null}
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  /** The phrase of `title` set in the serif italic. */
  accent?: string | null;
  lede?: string | null;
  eyebrow?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Photograph behind the title (title turns white; a warm shade keeps it readable). */
  image?: ReactNode;
  /** Short quotation shown under the lede on photo headers. */
  quote?: { text: string; source?: string | null } | null;
};

/**
 * Page title area used by every inner page, as a centered v4 opening:
 * breadcrumbs, the big Inter title with its serif italic phrase, the
 * subline. Pass `image` (a `<SanityImage fill />`) for the photographic
 * variant: the photo, desaturated, in a 40px rounded frame like the hero.
 */
export function PageHeader({ title, accent, lede, eyebrow, children, className, image, quote }: PageHeaderProps) {
  if (image) {
    return (
      <header className={cn("px-3 pt-3", className)}>
        <div className="relative isolate flex min-h-[30rem] flex-col items-center justify-end overflow-hidden rounded-[2rem] px-6 pb-12 pt-28 text-center text-paper sm:min-h-[34rem] sm:rounded-xl sm:pb-16 lg:min-h-[38rem]">
          <div className="absolute inset-0 -z-20 [&_img]:[filter:saturate(.5)_sepia(.2)_brightness(.98)]">{image}</div>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(18_13_8/0.5)_0%,rgb(18_13_8/0.22)_38%,rgb(18_13_8/0.3)_62%,rgb(18_13_8/0.7)_100%)]"
          />
          {eyebrow ? (
            <div className="mb-5 flex justify-center text-[0.8125rem] font-medium text-paper/80 [&_a:hover]:text-paper [&_[aria-current]]:text-paper">{eyebrow}</div>
          ) : null}
          <h1 className={cn("max-w-5xl text-paper", headline.display)}>
            <Accented text={title} phrase={accent} />
          </h1>
          {lede ? <p className="mx-auto mt-5 max-w-[40rem] text-balance text-[clamp(1.125rem,1rem+0.5vw,1.3125rem)] leading-snug text-paper/90">{lede}</p> : null}
          {quote?.text ? (
            <blockquote className="mx-auto mt-6 max-w-md text-paper/85">
              <p className="font-serif text-[1.25rem] italic leading-snug">{quote.text}</p>
              {quote.source ? <cite className="mt-1 block text-[0.8125rem] not-italic text-paper/70">{quote.source}</cite> : null}
            </blockquote>
          ) : null}
          {children}
        </div>
      </header>
    );
  }
  return (
    <header className={cn("pb-2 pt-10 sm:pt-14 lg:pt-20", className)}>
      <Container className="flex flex-col items-center text-center">
        {eyebrow ? <div className="mb-6 flex justify-center text-[0.8125rem] font-medium text-ink-3 [&_[aria-current]]:text-gold-ink">{eyebrow}</div> : null}
        <h1 className={cn("max-w-5xl", headline.display)}>
          <Accented text={title} phrase={accent} />
        </h1>
        {lede ? <p className="lede mx-auto mt-5 max-w-[40rem] text-balance lg:mt-6">{lede}</p> : null}
        {children}
      </Container>
    </header>
  );
}

/** Highlighted note (temporary information): a soft gold tile. */
export function Notice({ children, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <div className={cn("max-w-prose rounded-md bg-gold-soft px-5 py-4 text-body text-ink", className)}>{children}</div>;
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

const buttonShape =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-[color,background-color,border-color,transform] duration-200 hover:scale-[1.02] active:scale-[0.99] " +
  "focus-visible:outline-offset-4 disabled:opacity-60 disabled:pointer-events-none";
const buttonBase = `${buttonShape} min-h-11 px-5 text-[0.9375rem]`;

const buttonVariants = {
  primary: "bg-moss text-paper hover:bg-moss-deep",
  secondary: "bg-surface text-ink shadow-[0_0_0_1px_rgb(31_28_24/0.1)] hover:bg-paper-2",
  ghost: "text-moss hover:bg-moss-soft",
  onDark: "bg-paper text-ink hover:bg-paper-2",
  // Only for the editor (buttonClassName): removing or cancelling something.
  danger: "border border-alert/40 bg-paper text-alert hover:border-alert",
  dangerGhost: "text-alert hover:bg-alert-soft",
};

/**
 * The button look as a class string, for controls that cannot use `Button`
 * (the editor's buttons). `sm` is the compact size for dense rows: still a
 * 44px tap target.
 */
export function buttonClassName({ variant = "primary", size = "md" }: { variant?: keyof typeof buttonVariants; size?: ButtonProps["size"] | "sm" } = {}) {
  if (size === "sm") return cn(buttonShape, "min-h-11 px-4 text-small", buttonVariants[variant]);
  return cn(buttonBase, buttonVariants[variant], size === "lg" && "min-h-[3.25rem] px-7 text-lede");
}

/** Button or link that looks like a button. Tap target ≥ 44px. */
export function Button({ href, variant = "primary", size = "md", icon, className, children, type = "button", disabled, external }: ButtonProps) {
  const classes = cn(buttonClassName({ variant, size }), className);
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

/** Inline text link with a small arrow — for "see all" actions (the prototype's `.more`). */
export function TextLink({ href, children, className, external }: { href: string; children: ReactNode; className?: string; external?: boolean }) {
  const classes = cn(
    "group inline-flex min-h-11 items-center gap-1.5 rounded-full text-[0.9375rem] font-semibold tracking-[-0.01em] text-gold-ink hover:text-moss-deep",
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      <Icon name={external ? "external" : "arrow-right"} size={15} className="transition-transform duration-200 ease-out-soft group-hover:translate-x-[3px] motion-reduce:transform-none" />
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

/** Small pill label: category, status. Never the only carrier of meaning. */
export function Tag({ children, tone = "neutral", className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.8125rem] font-semibold tracking-[-0.005em]",
        tone === "neutral" && "bg-paper-2 text-ink-2",
        (tone === "moss" || tone === "gold") && "bg-gold-soft text-gold-ink",
        tone === "alert" && "bg-alert-soft text-alert",
        tone === "onDark" && "bg-paper/15 text-paper backdrop-blur",
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
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-gold-ink" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Honest empty state: what is missing and, where useful, what to do. */
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: { label: string; href: string } }) {
  return (
    <div className={cn(tile, "px-6 py-14 text-center sm:py-16")}>
      <p className="text-[1.375rem] font-bold leading-tight tracking-[-0.03em] text-ink">{title}</p>
      {text ? <p className="mx-auto mt-2 max-w-md text-body text-ink-2">{text}</p> : null}
      {action ? (
        <div className="mt-3">
          <TextLink href={action.href}>{action.label}</TextLink>
        </div>
      ) : null}
    </div>
  );
}

/** Breadcrumb trail; the last item is the current page. */
export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Pot" className={cn("text-[0.8125rem] font-medium", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="rounded-full hover:text-ink">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              )}
              {!last ? <Icon name="chevron-right" size={13} className="opacity-50" /> : null}
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
    <dl className={cn("divide-y divide-stone/70", className)}>
      {visible.map((item) => (
        <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <dt className="text-small font-medium text-ink-3">{item.label}</dt>
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
