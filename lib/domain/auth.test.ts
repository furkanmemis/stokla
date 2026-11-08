import { describe, expect, it } from "vitest";
import { authMessage, checkEmail, checkNewPassword, emailProven } from "./auth";

describe("checkEmail", () => {
  it("normalizes case and spaces", () => expect(checkEmail("  Ali@Ornek.COM ")).toEqual({ ok: true, value: "ali@ornek.com" }));
  it("rejects malformed addresses", () => expect(checkEmail("ali@").ok).toBe(false));
});

describe("checkNewPassword", () => {
  it("accepts 8+ characters with a letter and a digit", () => expect(checkNewPassword("pastane42", "pastane42")).toEqual({ ok: true, value: "pastane42" }));
  it("accepts Turkish letters", () => expect(checkNewPassword("çörekçi7ş").ok).toBe(true));
  it("rejects short passwords", () => expect(checkNewPassword("ab12").ok).toBe(false));
  it("needs a digit", () => expect(checkNewPassword("sadeceharf").ok).toBe(false));
  it("needs a letter", () => expect(checkNewPassword("12345678").ok).toBe(false));
  it("checks the repeat", () => expect(checkNewPassword("pastane42", "pastane43")).toEqual({ ok: false, error: "Şifreler aynı değil." }));
});

describe("authMessage", () => {
  it("explains wrong credentials", () => expect(authMessage({ code: "invalid_credentials" }, "x")).toBe("E-posta ya da şifre hatalı."));
  it("explains unconfirmed e-mail", () => expect(authMessage({ message: "Email not confirmed" }, "x")).toContain("doğrulamadın"));
  it("falls back for unknown errors", () => expect(authMessage({ message: "boom" }, "Tekrar dene.")).toBe("Tekrar dene."));
});

describe("emailProven", () => {
  it("accepts sessions from an e-mail link or code", () => {
    expect(emailProven([{ method: "otp", timestamp: 1 }])).toBe(true);
    expect(emailProven([{ method: "password" }, { method: "magiclink" }])).toBe(true);
  });
  it("refuses password-only sessions and junk", () => {
    expect(emailProven([{ method: "password" }])).toBe(false);
    expect(emailProven(undefined)).toBe(false);
    expect(emailProven("otp")).toBe(false);
  });
});
