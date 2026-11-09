import { describe, expect, it } from "vitest";
import { churchPlace } from "./churches";

describe("churchPlace", () => {
  it("drops the house number", () => {
    expect(churchPlace({ street: "Zgornje Pirniče 74b" })).toBe("Zgornje Pirniče");
    expect(churchPlace({ street: "Zgornje Pirniče 74 b" })).toBe("Zgornje Pirniče");
    expect(churchPlace({ street: "Spodnje Pirniče 3" })).toBe("Spodnje Pirniče");
  });

  it("keeps a street without a number", () => {
    expect(churchPlace({ street: "Spodnje Pirniče" })).toBe("Spodnje Pirniče");
  });

  it("is null without a street", () => {
    expect(churchPlace(null)).toBeNull();
    expect(churchPlace({})).toBeNull();
    expect(churchPlace({ street: "  " })).toBeNull();
  });
});
