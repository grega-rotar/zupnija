import { describe, expect, it } from "vitest";
import { weekStart } from "./clock";
import { formatDayMonth, formatDayShort, formatTime, formatWeekSpan, startOfWeek } from "./dates";

describe("one week, one format [unit]", () => {
  it("weeks run Sunday–Saturday on the site and in the editor", () => {
    expect(weekStart("2026-10-27")).toBe("2026-10-25");
    expect(weekStart("2026-10-25")).toBe("2026-10-25");
    expect(weekStart("2026-10-31")).toBe("2026-10-25");
    expect(weekStart("2026-11-01")).toBe("2026-11-01");
    expect(weekStart("2026-10-27")).toBe(startOfWeek("2026-10-27"));
  });

  it("formats weeks, short days and times", () => {
    expect(formatWeekSpan("2026-10-25", "2026-10-31")).toBe("25.–31. oktober");
    expect(formatWeekSpan("2026-11-01", "2026-11-07", true)).toBe("1.–7. november 2026");
    expect(formatWeekSpan("2026-11-29", "2026-12-05")).toBe("29. nov – 5. dec");
    expect(formatWeekSpan("2026-12-27", "2027-01-02", true)).toBe("27. dec 2026 – 2. jan 2027");
    expect(formatDayShort("2026-11-03")).toBe("tor 3. nov");
    expect(formatDayMonth("2026-10-12")).toBe("12. oktober");
    expect(formatTime("07:00:00")).toBe("7.00");
  });
});
