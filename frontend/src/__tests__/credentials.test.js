import { describe, it, expect, beforeEach } from "vitest";
import { stripCredentials, scrubStoredCredentials, PERSONAL_CREDENTIALS_KEY } from "../utils/credentials.js";

describe("credentials utils", () => {
  beforeEach(() => localStorage.clear());

  it("stripCredentials removes login and password only", () => {
    const out = stripCredentials({ login: "a", password: "b", universityId: "x" });
    expect(out).toEqual({ universityId: "x" });
  });

  it("scrubStoredCredentials removes leaked secrets from metadata but keeps remembered credentials", () => {
    localStorage.setItem("edt_personal_meta", JSON.stringify({ name: "Moi", login: "a", password: "b" }));
    localStorage.setItem("personalScheduleMeta", JSON.stringify({ password: "b" }));
    localStorage.setItem(PERSONAL_CREDENTIALS_KEY, JSON.stringify({ login: "a", password: "b" }));

    scrubStoredCredentials();

    expect(JSON.parse(localStorage.getItem("edt_personal_meta"))).toEqual({ name: "Moi" });
    expect(JSON.parse(localStorage.getItem("personalScheduleMeta"))).toEqual({});
    expect(JSON.parse(localStorage.getItem(PERSONAL_CREDENTIALS_KEY))).toEqual({ login: "a", password: "b" });
  });

  it("scrubStoredCredentials ignores malformed entries", () => {
    localStorage.setItem("edt_personal_meta", "{not json");
    expect(() => scrubStoredCredentials()).not.toThrow();
    expect(localStorage.getItem("edt_personal_meta")).toBe("{not json");
  });
});
