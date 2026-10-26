import { PortableText, type PortableTextComponents, type PortableTextBlock } from "next-sanity";
import { cn, formatFileSize } from "@/lib/utils";
import { isExternalHref } from "@/lib/links";
import { Icon } from "@/components/ui/Icon";
import { Figure, type SanityImageValue } from "./SanityImage";

/** Any Portable Text array as produced by TypeGen (block content, simple block content …). */
export type PortableTextValue = ReadonlyArray<{ _type: string; _key: string }>;

type AttachmentValue = {
  _key?: string;
  title?: string | null;
  file?: { asset?: { url: string; extension?: string | null; size?: number | null } | null } | null;
};

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  },
  list: {
    bullet: ({ children }) => <ul>{children}</ul>,
    number: ({ children }) => <ol>{children}</ol>,
  },
  marks: {
    strong: ({ children }) => <strong>{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    link: ({ children, value }) => {
      const href = (value as { href?: string } | undefined)?.href;
      if (!href) return <>{children}</>;
      const external = isExternalHref(href);
      return (
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {children}
        </a>
      );
    },
  },
  types: {
    imageWithAlt: ({ value }) => (
      <Figure image={value as SanityImageValue} sizes="(min-width: 768px) 42rem, 100vw" maxWidth={1400} />
    ),
    attachment: ({ value }) => <AttachmentLink attachment={value as AttachmentValue} />,
  },
};

type Props = {
  value: PortableTextValue | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
};

/** Portable Text → semantic HTML with the site's editorial styles. */
export function RichText({ value, className, size = "md" }: Props) {
  if (!value?.length) return null;
  return (
    <div className={cn("prose", size === "lg" && "prose-lg", size === "sm" && "prose-sm", className)}>
      <PortableText value={value as PortableTextBlock[]} components={components} />
    </div>
  );
}

/** One downloadable file row. */
export function AttachmentLink({ attachment, className }: { attachment: AttachmentValue; className?: string }) {
  const url = attachment.file?.asset?.url;
  if (!url) return null;
  const ext = attachment.file?.asset?.extension?.toUpperCase();
  const size = formatFileSize(attachment.file?.asset?.size);
  const meta = [ext, size].filter(Boolean).join(" · ");
  return (
    <a
      href={`${url}?dl=`}
      className={cn(
        "group flex min-h-12 items-center gap-3 rounded-md border border-stone bg-paper px-4 py-3 no-underline transition-colors hover:border-ink",
        className,
      )}
    >
      <Icon name="document" size={22} className="shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink group-hover:underline">{attachment.title || "Priponka"}</span>
        {meta ? <span className="block text-meta text-ink-3">{meta}</span> : null}
      </span>
      <Icon name="download" size={18} className="shrink-0 text-ink-3" />
    </a>
  );
}

/** List of attachments with a heading; renders nothing when empty. */
export function Attachments({ items, title = "Priponke" }: { items: AttachmentValue[] | null | undefined; title?: string }) {
  const list = (items ?? []).filter((a) => a.file?.asset?.url);
  if (!list.length) return null;
  return (
    <section aria-label={title} className="mt-10">
      <h2 className="mb-3 text-h3">{title}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((a, i) => (
          <li key={a._key ?? i}>
            <AttachmentLink attachment={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}
