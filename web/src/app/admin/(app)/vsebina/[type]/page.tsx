import { ContentList } from "@/components/admin/vsebina/ContentList";
import { needsApproval } from "@/lib/admin/sections";
import type { ContentType } from "@/lib/content/fields";
import { FormPage } from "../form-page";
import { listDocs, requireType } from "../queries";

/** One plain sentence under each list's title. */
const LEDE: Partial<Record<ContentType, string>> = {
  page: "Stalne strani, npr. O župniji in Zasebnost, sestavljene iz odsekov.",
  article: "Novice iz župnije. Najnovejše so na vrhu.",
  announcement: "Krajša obvestila za domačo stran in seznam obvestil.",
  gallery: "Fotografije z dogodkov, po datumu.",
  parishDocument: "Obrazci, prijavnice in drugi dokumenti za prenos.",
  specialPeriod: "Advent, post, žegnanje … Prikazano samo v izbranem času.",
  church: "Cerkve župnije, v vrstnem redu, kot so na strani.",
  person: "Duhovniki in sodelavci, kot so na strani Župnija.",
  parishGroup: "Zbori, skupine in dejavnosti.",
  sacrament: "Zakramenti in kako se zanje dogovoriti.",
};

/** /vsebina/<type>: the list, or a singleton's form straight away. */
export default async function ContentTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const { def, actor } = await requireType(type);
  if (def.singleton) return <FormPage def={def} id={def.type} singleton approval={needsApproval(actor)} isOwner={actor.isOwner} />;
  const rows = await listDocs(def);
  return <ContentList type={def.type} rows={rows} lede={LEDE[def.type] ?? ""} />;
}
