import { PeopleScreen, type PersonView } from "@/components/admin/ljudje/PeopleScreen";
import { requirePageArea } from "@/lib/admin/next";
import { listPeople } from "@/lib/ljudje/queries";
import { lastSeen } from "@/lib/zgodovina/time";

/** Ljudje in dostop (owner only). Panels: ?oseba=<id> and ?povabi=1. */
export default async function PeoplePage() {
  await requirePageArea("ljudje");
  // The owner first, then whoever was here most recently; invitations last.
  const seen = (p: { isOwner: boolean; lastSeenAt: Date | null }) => (p.isOwner ? Infinity : (p.lastSeenAt?.getTime() ?? -Infinity));
  const sorted = (await listPeople()).sort((a, b) => seen(b) - seen(a) || a.name.localeCompare(b.name, "sl"));
  const people: PersonView[] = sorted.map((p) => ({
    id: p.id,
    name: p.name,
    short: p.short,
    title: p.title,
    email: p.email,
    isOwner: p.isOwner,
    sections: p.sections,
    requiresApproval: p.requiresApproval,
    invited: p.invited,
    status: p.invited
      ? "povabilo poslano, še ni prijavljen"
      : p.isOwner
        ? "ureja vse"
        : p.lastSeenAt
          ? `nazadnje ${lastSeen(p.lastSeenAt)}`
          : "še ni prijavljen",
  }));
  return <PeopleScreen people={people} />;
}
