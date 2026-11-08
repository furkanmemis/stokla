import { describe, expect, it } from "vitest";
import { checkTake, totalUnits } from "./pool";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("checkTake", () => {
  it("merges lines and accepts what the pool has", () => {
    expect(checkTake([{ id: A, qty: 2 }, { id: A, qty: 3 }, { id: B, qty: 1 }], { [A]: 5, [B]: 1 }))
      .toEqual({ ok: true, lines: [{ id: A, qty: 5 }, { id: B, qty: 1 }] });
  });
  it("refuses more than the pool has, naming the product", () => {
    expect(checkTake([{ id: A, qty: 6 }], { [A]: 5 }, { [A]: "Sütlaç" }))
      .toEqual({ ok: false, error: "Havuzda Sütlaç için 5 var, 6 alınamaz." });
  });
  it("refuses an empty request", () => {
    expect(checkTake([{ id: A, qty: 0 }], { [A]: 5 }).ok).toBe(false);
    expect(checkTake("nope", {}).ok).toBe(false);
  });
});

describe("totalUnits", () => {
  it("adds up the units", () => expect(totalUnits([{ qty: 2 }, { qty: 3.5 }])).toBe(5.5));
});
