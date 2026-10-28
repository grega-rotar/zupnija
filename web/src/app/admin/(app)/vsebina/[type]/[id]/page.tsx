import { redirect } from "next/navigation";
import { needsApproval } from "@/lib/admin/sections";
import { FormPage } from "../../form-page";
import { requireType } from "../../queries";

/** /vsebina/<type>/<id> (or /nov): the generic form. A singleton lives at /vsebina/<type>. */
export default async function ContentDocPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  const { def, actor } = await requireType(type);
  if (def.singleton) redirect(`/vsebina/${def.type}`);
  return <FormPage def={def} id={id === "nov" ? null : decodeURIComponent(id)} approval={needsApproval(actor)} isOwner={actor.isOwner} />;
}
