import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchUniversities, fetchPersonalCalendar } from "../ics/api.js";

describe("fetchUniversities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the parsed JSON list on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "grenoble-inp-esisar", name: "Grenoble INP - Esisar" }],
    });

    const list = await fetchUniversities();
    expect(list).toEqual([{ id: "grenoble-inp-esisar", name: "Grenoble INP - Esisar" }]);
    expect(global.fetch).toHaveBeenCalledWith("/api/universities", { cache: "no-store" });
  });

  it("throws when the response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchUniversities()).rejects.toThrow(/500/);
  });
});

describe("fetchPersonalCalendar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the credentials and returns the decoded ICS body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("BEGIN:VCALENDAR\r\nEND:VCALENDAR").buffer,
    });

    const text = await fetchPersonalCalendar({
      universityId: "grenoble-inp-esisar",
      login: "student1",
      password: "hunter2",
    });

    expect(text).toContain("BEGIN:VCALENDAR");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/personal-calendar",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId: "grenoble-inp-esisar",
          login: "student1",
          password: "hunter2",
        }),
      })
    );
  });

  it("surfaces the server-provided error message on failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid credentials" }),
    });

    await expect(
      fetchPersonalCalendar({ universityId: "x", login: "a", password: "b" })
    ).rejects.toThrow("invalid credentials");
  });
});
