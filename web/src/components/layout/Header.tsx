import Link from "next/link";
import { navigation, routes } from "@/lib/routes";
import { Container } from "@/components/ui/primitives";
import { ChurchMark } from "@/components/ui/ChurchMark";
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
