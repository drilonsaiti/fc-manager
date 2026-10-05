import { describe, expect, it } from "vitest";
import { formatDay, formatTime } from "./dates";

const d = new Date(2026, 9, 6, 16, 5); // Tuesday 6 October 2026
describe("dates", () => {
  it("writes days and months in each language", () => {
    expect(formatDay(d, "en-GB")).toBe("Tue, 6 Oct");
    expect(formatDay(d, "sq-AL")).toBe("mar, 6 tet");
    expect(formatDay(d, "mk-MK")).toBe("вто, 6 окт");
    expect(formatDay(d, "sq-AL", { weekday: "long", month: "long" })).toBe("e martë 6 tetor");
    expect(formatDay(d, "mk-MK", { weekday: "long", month: "long", year: true })).toBe("вторник 6 октомври 2026");
  });
  it("uses 24-hour time", () => expect(formatTime(d)).toBe("16:05"));
});
