import Link from "next/link";
import { routes } from "@/lib/routes";
import { Container } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

type Item = { _id: string; title: string; slug: string | null; summary: string | null };

/** Thin strip above the header for "urgent" announcements. Rarely visible. */
export function UrgentBanner({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <div role="region" aria-label="Nujno obvestilo" className="bg-alert text-paper">
      <Container className="py-2.5">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item._id} className="flex items-start gap-2 text-small">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <p className="min-w-0">
                <span className="font-medium">{item.title}</span>
                {item.summary ? <span className="opacity-90"> — {item.summary}</span> : null}{" "}
                {item.slug ? (
                  <Link href={routes.announcement(item.slug)} className="underline underline-offset-2 hover:opacity-90">
                    Več
                  </Link>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
