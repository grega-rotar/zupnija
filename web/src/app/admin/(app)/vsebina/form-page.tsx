import { notFound } from "next/navigation";
import { ContentForm } from "@/components/admin/vsebina/ContentForm";
import { initialDoc, type TypeDef } from "@/lib/content/fields";
import { getDoc, refOptions, siteOrigin } from "./queries";

/**
 * The form for one document: `id` null for a new one; a singleton whose row
 * doesn't exist yet starts empty (content.save creates it with its fixed id).
 */
export async function FormPage({ def, id, singleton, approval, isOwner }: { def: TypeDef; id: string | null; singleton?: boolean; approval: boolean; isOwner: boolean }) {
  const [row, refs, origin] = await Promise.all([id ? getDoc(def, id) : null, refOptions(def), siteOrigin()]);
  if (id && !row && !singleton) notFound();
  const doc = row?.data ?? { ...initialDoc(def), ...(singleton ? { _id: def.type } : {}) };
  return (
    <ContentForm
      key={row?.id ?? "nov"}
      type={def.type}
      id={row?.id ?? null}
      doc={doc}
      published={row?.published ?? true}
      refs={refs}
      origin={origin}
      isOwner={isOwner}
      approval={approval}
    />
  );
}
