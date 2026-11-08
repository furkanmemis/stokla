import { describe, expect, it } from "vitest";
import { pageOf } from "./paging";

describe("pageOf", () => {
  it("starts at page 1", () => {
    expect(pageOf(undefined, 60, 25)).toEqual({ page: 1, pageCount: 3, from: 0, to: 24, hasPrev: false, hasNext: true });
  });
  it("returns the range of a middle page", () => {
    expect(pageOf("2", 60, 25)).toMatchObject({ page: 2, from: 25, to: 49, hasPrev: true, hasNext: true });
  });
  it("clamps pages past the end and below 1", () => {
    expect(pageOf(9, 60, 25)).toMatchObject({ page: 3, hasNext: false });
    expect(pageOf(-4, 60, 25).page).toBe(1);
  });
  it("ignores garbage", () => expect(pageOf("abc", 60, 25).page).toBe(1));
  it("has one page when empty", () => expect(pageOf(1, 0, 25)).toMatchObject({ page: 1, pageCount: 1, hasNext: false }));
});
