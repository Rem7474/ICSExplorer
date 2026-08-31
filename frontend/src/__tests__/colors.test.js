import { describe, it, expect } from "vitest";
import { getSubjectType, getSubjectColors } from "../utils/colors.js";

describe("colors utils", () => {
  it("detects known subject types correctly", () => {
    expect(getSubjectType("IN101 Algo")).toBe("IN");
    expect(getSubjectType("SN201 Signal")).toBe("SN");
    expect(getSubjectType("LV01 Anglais")).toBe("LV");
    expect(getSubjectType("PR301 Recherche")).toBe("PR");
    expect(getSubjectType("Cercle Soiree")).toBe("CERCLE");
    expect(getSubjectType("Conférence Divers")).toBe("DEFAULT");
  });

  it("returns appropriate subject colors for light and dark modes", () => {
    const lightColors = getSubjectColors("IN101", false);
    expect(lightColors.background).toBe("var(--color-IN)");
    expect(lightColors.border).toBe("var(--border-IN)");

    const darkColors = getSubjectColors("IN101", true);
    expect(darkColors.background).toBe("var(--color-IN)");
  });
});
