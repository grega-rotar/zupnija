/** Shared setup for the public forms' tests: the parish inbox in Nastavitve. */
import { db, schema } from "@/db";

export const PARISH = "zupnija@example.com";

export async function seedSettings(extra: Record<string, unknown> = {}): Promise<void> {
  await db.insert(schema.content).values({
    id: "settings",
    type: "settings",
    data: {
      _id: "settings",
      _type: "settings",
      name: "Župnija Pirniče",
      email: "info@example.com",
      contactFormRecipient: PARISH,
      emergencyContact: { label: "Za bolniško maziljenje in pogreb", phone: "041 604 422" },
      ...extra,
    },
  });
}
