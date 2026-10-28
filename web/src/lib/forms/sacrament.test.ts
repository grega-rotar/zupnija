import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { perform, undo } from "@/lib/admin/engine";
import { clearDevOutbox, devOutbox } from "@/lib/mail";
import { enquiryKind } from "@/lib/sacraments/kinds";
import { listOpenSacramentRequests, submitSacramentRequest } from "@/lib/sacraments/requests";
import { makeUser, resetDb } from "@/test/db";
import { emergencyContact } from "./parish";
import { PARISH, seedSettings } from "./test-support";

const rows = () => db.select().from(schema.sacramentRequests);
const KRST = { kind: "krst", name: "Ana Kralj", contact: "ana@example.com", date: "2027-01-10", message: "Radi bi krstili hčerko." };

describe("Sacrament enquiries (US-008)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedSettings();
    clearDevOutbox();
  });

  it("stores the enquiry and mails the parish 'Povpraševanje: Krst · Ana Kralj'", async () => {
    const r = await submitSacramentRequest(KRST, { ip: "1.1.1.1" });
    expect(r.ok).toBe(true);
    const [row] = await rows();
    expect(row).toMatchObject({ kind: "krst", name: "Ana Kralj", contact: "ana@example.com", preferredDate: "2027-01-10", message: "Radi bi krstili hčerko.", status: "new" });
    expect(devOutbox().map((m) => [m.to, m.subject])).toEqual([[PARISH, "Povpraševanje: Krst · Ana Kralj"]]);
  });

  it("takes every kind (also the PRD's 'bolniško_maziljenje') and rejects others", async () => {
    for (const kind of ["prvo_obhajilo", "birma", "poroka", "bolniško_maziljenje", "pogreb", "drugo"]) {
      expect((await submitSacramentRequest({ ...KRST, kind, date: "" }, { ip: `ip-${kind}` })).ok).toBe(true);
    }
    expect((await rows()).map((r) => r.kind)).toContain("bolnisko_maziljenje");
    const bad = await submitSacramentRequest({ ...KRST, kind: "spoved" }, { ip: "2.2.2.2" });
    expect(bad).toMatchObject({ ok: false, fieldErrors: { kind: "Izberite, za kaj sprašujete." } });
  });

  it("needs a phone or an e-mail and a message", async () => {
    const r = await submitSacramentRequest({ ...KRST, contact: "x", message: "" }, { ip: "1.1.1.1" });
    expect(r).toMatchObject({ ok: false, fieldErrors: { contact: "Vpišite telefon ali e-poštni naslov.", message: "Na kratko opišite, kaj želite." } });
    expect(await rows()).toHaveLength(0);
  });

  it("each sacrament page preselects its kind", () => {
    expect(enquiryKind("baptism", "krst")).toBe("krst");
    expect(enquiryKind("anointing", "bolnisko-maziljenje")).toBe("bolnisko_maziljenje");
    expect(enquiryKind("confirmation", "sveta-birma")).toBe("birma");
    expect(enquiryKind("confession", "spoved")).toBe("drugo");
    expect(enquiryKind(null, "pogreb")).toBe("pogreb");
  });

  it("the emergency phone comes from settings", async () => {
    expect(await emergencyContact()).toEqual({ label: "Za bolniško maziljenje in pogreb", phone: "041 604 422" });
  });

  it("'Označi kot rešeno' removes it from the Domov list, with history and undo; Župnija area only", async () => {
    const blaz = await makeUser("blaz", { isOwner: true });
    const ana = await makeUser("ana", { sections: ["verouk"] });
    const zala = await makeUser("zala", { sections: ["zupnija"], requiresApproval: true });
    await submitSacramentRequest(KRST, { ip: "1.1.1.1" });
    const [open] = await listOpenSacramentRequests();
    expect(open).toMatchObject({ kind: "krst", name: "Ana Kralj" });

    await expect(perform(ana, "sacramentRequest.resolve", { requestId: open.id })).rejects.toThrow("forbidden");
    // A plain status flip: applied directly even for a helper who needs approval.
    const r = await perform(zala, "sacramentRequest.resolve", { requestId: open.id });
    expect(r.status).toBe("applied");
    expect(await listOpenSacramentRequests()).toHaveLength(0);
    const [h] = await db.select().from(schema.history);
    expect(h.label).toBe("Rešeno povpraševanje: Krst · Ana Kralj");

    await undo(blaz, (r as { historyId: number }).historyId);
    expect(await listOpenSacramentRequests()).toHaveLength(1);
    const [row] = await db.select().from(schema.sacramentRequests).where(eq(schema.sacramentRequests.id, open.id));
    expect(row.resolvedBy).toBeNull();
  });
});
