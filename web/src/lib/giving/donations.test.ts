import { describe, expect, it } from "vitest";
import type { SETTINGS_QUERY_RESULT } from "@/sanity/types.generated";
import { givingFrom, groupIban } from "./donations";
import { parseUpnQr } from "./upnqr";

const settings = {
  name: "Župnija Pirniče",
  address: { street: "Zgornje Pirniče 74b", postalCode: "1215", city: "Medvode" },
  donations: { iban: "SI56 0202 1026 2993 393", recipient: "Župnija Pirniče", purpose: "Dar za župnijo", bic: "LJBASI2X", reference: null, intro: null },
} as unknown as SETTINGS_QUERY_RESULT;

describe("givingFrom", () => {
  it("builds the general QR from settings.donations and the parish address", () => {
    const g = givingFrom(settings, [], "2026-10-27")!;
    expect(g.iban).toBe("SI56020210262993393");
    expect(g.ibanGrouped).toBe("SI56 0202 1026 2993 393");
    expect(parseUpnQr(g.payload)).toMatchObject({ name: "Župnija Pirniče", street: "Zgornje Pirniče 74b", city: "1215 Medvode", purpose: "Dar za župnijo", amount: "", code: "CHAR" });
  });

  it("gives each current purpose its own QR with its amount; past ones are hidden", () => {
    const g = givingFrom(
      settings,
      [
        { _id: "p1", title: "Oratorij 2027", amount: 40, purpose: "Oratorij 2027 - prispevek", until: "2027-07-01" },
        { _id: "p2", title: "Popravilo strehe", purpose: "Streha", until: "2026-10-01" },
        { _id: "p3", title: "Karitas", purpose: "Karitas", reference: "SI00 77" },
      ],
      "2026-10-27",
    )!;
    expect(g.purposes.map((p) => p.title)).toEqual(["Oratorij 2027", "Karitas"]);
    expect(parseUpnQr(g.purposes[0].payload)).toMatchObject({ amount: "00000004000", purpose: "Oratorij 2027 - prispevek" });
    expect(parseUpnQr(g.purposes[1].payload)).toMatchObject({ amount: "", reference: "SI0077" });
  });

  it("is null without an IBAN or with a broken one, so /daruj is 404 and the footer block is hidden", () => {
    expect(givingFrom({ ...settings!, donations: { ...settings!.donations!, iban: "" } } as SETTINGS_QUERY_RESULT, [], "2026-10-27")).toBeNull();
    expect(givingFrom({ ...settings!, donations: { ...settings!.donations!, iban: "ni iban" } } as SETTINGS_QUERY_RESULT, [], "2026-10-27")).toBeNull();
    expect(givingFrom(null, [], "2026-10-27")).toBeNull();
  });

  it("groups an IBAN in fours", () => {
    expect(groupIban("si56020210262993393")).toBe("SI56 0202 1026 2993 393");
  });
});
