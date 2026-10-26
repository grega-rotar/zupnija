import Link from "next/link";
import { navigation, routes } from "@/lib/routes";
import { Container } from "@/components/ui/primitives";
import { Nav } from "./Nav";

/** Light header: church mark + wordmark, quiet navigation, one green action. */
export function Header({ parishName }: { parishName: string }) {
  const [first, ...rest] = parishName.split(" ");
  return (
    <header className="sticky top-0 z-30 border-b border-stone bg-paper">
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-20">
        <Link href={routes.home} className="flex min-h-11 items-center gap-3 rounded-sm" aria-label={`${parishName} — domov`}>
          <ChurchMark />
          <span className="font-sans text-[0.8125rem] font-semibold uppercase leading-[1.15] tracking-[0.16em] text-ink">
            {first}
            {rest.length ? (
              <>
                <br />
                {rest.join(" ")}
              </>
            ) : null}
          </span>
        </Link>
        <Nav items={navigation} searchHref={routes.search} />
      </Container>
    </header>
  );
}

/** Line drawing of a village church: nave, tower, cross. */
function ChurchMark() {
  return (
    <svg
      width="34"
      height="40"
      viewBox="0 0 34 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      className="shrink-0 text-ink"
    >
      <path d="M12 2v5M9.5 4.5h5" />
      <path d="M8 39V14l4-6 4 6v25" />
      <path d="M16 20h13l3 5v14H16" />
      <path d="M8 39H2V27l6-4" />
      <path d="M11 32h2M25 32h2M10.5 17.5h3" />
      <path d="M1 39h32" />
    </svg>
  );
}
