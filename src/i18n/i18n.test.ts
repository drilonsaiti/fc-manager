import { describe, expect, it } from "vitest";
import { en } from "./en";
import { sq } from "./sq";
import { mk } from "./mk";
import { fill } from "./index";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  for (const [name, dict] of [["sq", sq], ["mk", mk]] as const) {
    it(`${name} has exactly the English keys`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
    });
    it(`${name} keeps the same {placeholders} as English`, () => {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(placeholders(dict[key]), key).toEqual(placeholders(en[key]));
      }
    });
    it(`${name} has no empty strings`, () => {
      for (const v of Object.values(dict)) expect(v.trim().length).toBeGreaterThan(0);
    });
  }
  it("fills params and leaves unknown ones visible", () => {
    expect(fill("Hi {name}", { name: "Arben" })).toBe("Hi Arben");
    expect(fill("Hi {name}", {})).toBe("Hi {name}");
  });
});
