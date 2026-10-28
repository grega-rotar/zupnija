"use client";

import { Fragment, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { buttonClassName } from "@/components/ui/primitives";
import { filterByQuery } from "./groupSearch";

export type GroupSearchRow = { id: string; text: string; node: ReactNode };

/**
 * "Išči skupino ali dejavnost" above the group tiles (US-012). Filters as
 * you type and keeps the query in the URL (`?q=zbor`), so a reload or a
 * shared link shows the same cards; the server renders the first state from
 * `?q=` too. Without JavaScript the field submits as a GET form.
 */
export function GroupSearch({ rows, initialQuery, action }: { rows: GroupSearchRow[]; initialQuery: string; action: string }) {
  const [query, setQuery] = useState(initialQuery);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const visible = filterByQuery(rows, query);

  function update(next: string) {
    setQuery(next);
    const url = new URL(window.location.href);
    if (next.trim()) url.searchParams.set("q", next.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <>
      <form
        role="search"
        action={action}
        className="mx-auto mb-10 max-w-xl lg:mb-14"
        onSubmit={(e) => {
          e.preventDefault();
          input.current?.blur();
        }}
      >
        <label htmlFor={id} className="sr-only">
          Išči skupino ali dejavnost
        </label>
        <div className="relative">
          <Icon name="search" size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={input}
            id={id}
            name="q"
            type="search"
            value={query}
            onChange={(e) => update(e.target.value)}
            placeholder="Išči skupino ali dejavnost"
            autoComplete="off"
            enterKeyHint="search"
            className="h-14 w-full rounded-full bg-surface pl-13 pr-5 text-[1.0625rem] text-ink shadow-soft outline-none placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-search-cancel-button]:cursor-pointer"
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {query.trim() ? `Najdenih skupin: ${visible.length}` : ""}
        </p>
      </form>

      {visible.length ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {visible.map((r) => (
            <Fragment key={r.id}>{r.node}</Fragment>
          ))}
        </ul>
      ) : (
        <div className="mx-auto max-w-md rounded-lg bg-surface px-6 py-12 text-center shadow-soft">
          <p className="text-body text-ink-2">Nobena skupina ne ustreza iskanju.</p>
          <button
            type="button"
            className={cn(buttonClassName({ variant: "secondary" }), "mt-5")}
            onClick={() => {
              update("");
              input.current?.focus();
            }}
          >
            Počisti
          </button>
        </div>
      )}
    </>
  );
}

