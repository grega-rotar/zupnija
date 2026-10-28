import { notFound } from "next/navigation";
import { Enrolments, type EnrolmentRow } from "@/components/admin/requests/Enrolments";
import { VeroukTabs } from "@/components/admin/requests/Tabs";
import { PageHead } from "@/components/admin/ui";
import { can } from "@/lib/admin/sections";
import { requireActor } from "@/lib/admin/session";
import { formatDate } from "@/lib/dates";
import { ACTIVITY_LABEL, isEnrolmentOpen, listEnrolments, schoolYear, shortYear } from "@/lib/verouk/enrolment";

/** Verouk → Vpisi (US-006). Not in the Verouk area: 404 (the list holds children's data). */
export default async function VpisiPage() {
  const actor = await requireActor();
  if (!can(actor, "verouk")) notFound();
  const [list, open] = await Promise.all([listEnrolments(), isEnrolmentOpen()]);
  const rows: EnrolmentRow[] = list.map((e) => {
    const d = e.data;
    const parents: EnrolmentRow["parents"] = [];
    if (d.fatherName) parents.push({ who: "Oče", name: d.fatherName, contact: [d.fatherPhone, d.fatherEmail].filter(Boolean).join(", ") });
    if (d.motherName) parents.push({ who: "Mati", name: d.motherName, contact: [d.motherPhone, d.motherEmail].filter(Boolean).join(", ") });
    return {
      id: e.id,
      number: e.number,
      child: e.childName,
      grade: e.grade,
      group: e.group,
      parents,
      activities: (d.activities ?? []).map((a) => ACTIVITY_LABEL[a] ?? a),
      photoArchive: !!d.photoArchive,
      photoPublish: !!d.photoPublish,
      at: formatDate(e.createdAt.slice(0, 10)),
    };
  });

  return (
    <div className="page enter">
      <PageHead title="Verouk" sub="Spletni vpisi. Vsak vpis je prišel tudi po e-pošti v župnišče." />
      <VeroukTabs current="/verouk/vpisi" enrolments={rows.length} />
      <Enrolments rows={rows} open={open} year={shortYear(schoolYear())} />
    </div>
  );
}
