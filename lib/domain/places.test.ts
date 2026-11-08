import { describe, expect, it } from "vitest";
import { checkPlace, fits, homeFor, navFor, placeKind, resolvePlace } from "./places";

const place = (id: string, can_produce: boolean, can_sell: boolean, active = true) =>
  ({ id, name: id, can_produce, can_sell, active });

const merkez = place("Merkez", true, true);
const atolye = place("Atolye", true, false);
const avm = place("AVM", false, true);
const sahil = place("Sahil", false, true);
const closed = place("Eski", false, true, false);
const all = [merkez, atolye, avm, sahil, closed];

describe("placeKind and fits", () => {
  it("describes what a place does", () => {
    expect(placeKind(merkez)).toBe("Üretim ve satış");
    expect(placeKind(atolye)).toBe("Üretim");
    expect(placeKind(avm)).toBe("Satış");
  });
  it("matches screens to places", () => {
    expect(fits(avm, "produce")).toBe(false);
    expect(fits(avm, "sell")).toBe(true);
    expect(fits(atolye, null)).toBe(true);
  });
});

describe("checkPlace", () => {
  const input = { name: " Sahil 2 ", address: " Sahil Mah. ", canProduce: false, canSell: true };
  it("accepts a place and trims text", () => {
    expect(checkPlace(input, all)).toEqual({ ok: true, value: { name: "Sahil 2", address: "Sahil Mah.", canProduce: false, canSell: true } });
  });
  it("rejects a place that does nothing, an empty or taken name", () => {
    expect(checkPlace({ ...input, canSell: false }, all).ok).toBe(false);
    expect(checkPlace({ ...input, name: "  " }, all).ok).toBe(false);
    expect(checkPlace({ ...input, name: "avm" }, all).ok).toBe(false);
    expect(checkPlace({ ...input, name: "AVM" }, all, "AVM").ok).toBe(true); // renaming itself is fine
  });
  it("leaves an empty address out", () => {
    const r = checkPlace({ ...input, address: "  " }, all);
    expect(r.ok && r.value.address).toBe(null);
  });
});

describe("resolvePlace", () => {
  it("keeps employees at their own place", () => {
    expect(resolvePlace({ role: "employee", assignedId: "AVM", chosenId: "Merkez", places: all, need: "sell" }))
      .toEqual({ ok: true, place: avm });
    expect(resolvePlace({ role: "employee", assignedId: "AVM", chosenId: null, places: all, need: "produce" }))
      .toEqual({ ok: false, reason: "cannot" });
    expect(resolvePlace({ role: "employee", assignedId: "Eski", chosenId: null, places: all, need: null }))
      .toEqual({ ok: false, reason: "unassigned" });
  });
  it("lets admins pick, falling back to the first place that fits", () => {
    expect(resolvePlace({ role: "admin", assignedId: null, chosenId: "Sahil", places: all, need: "sell" }))
      .toEqual({ ok: true, place: sahil });
    expect(resolvePlace({ role: "admin", assignedId: null, chosenId: "Sahil", places: all, need: "produce" }))
      .toEqual({ ok: true, place: merkez });
    expect(resolvePlace({ role: "admin", assignedId: null, chosenId: null, places: [], need: null }))
      .toEqual({ ok: false, reason: "no-places" });
  });
});

describe("navFor", () => {
  it("gives employees the screens their place needs", () => {
    expect(navFor("employee", avm).map((i) => i.href)).toEqual(["/app/sales", "/app/pool", "/app/stock"]);
    expect(navFor("employee", atolye).map((i) => i.href)).toEqual(["/app/production", "/app/pool", "/app/stock"]);
    expect(navFor("employee", merkez)[0].href).toBe("/app/sales");
  });
  it("sends unassigned employees to the waiting screen", () => {
    expect(navFor("employee", null)).toEqual([]);
    expect(homeFor("employee", closed)).toBe("/app/waiting");
  });
  it("gives admins everything, starting with the overview", () => {
    expect(homeFor("admin", null)).toBe("/app/overview");
    expect(navFor("admin", null).map((i) => i.href)).toContain("/app/places");
  });
});
