import { describe, it, expect } from "vitest";
import { getSubjectType, getSubjectColors, getSubjectFullName } from "../utils/colors.js";

describe("colors utils", () => {
  it("detects known subject types correctly", () => {
    expect(getSubjectType("IN101 Algo")).toBe("IN");
    expect(getSubjectType("SN201 Signal")).toBe("SN");
    expect(getSubjectType("LV01 Anglais")).toBe("LV");
    expect(getSubjectType("PR301 Recherche")).toBe("PR");
    expect(getSubjectType("Cercle Soiree")).toBe("CERCLE");
    expect(getSubjectType("CM - Management des Systèmes d'Information")).toBe("MAC");
    expect(getSubjectType("TD Anglais Professionnel")).toBe("LV");
    expect(getSubjectType("TP Développement Web")).toBe("IN");
    expect(getSubjectType("Conférence Divers")).toBe("CONFÉRENCE DIVERS");
  });

  it("returns human-readable subject names", () => {
    expect(getSubjectFullName("IN")).toBe("Informatique");
    expect(getSubjectFullName("SN")).toBe("Signal & Numérique");
    expect(getSubjectFullName("LV")).toBe("Langues Vivantes");
    expect(getSubjectFullName("CERCLE")).toBe("Cercle des Élèves");
    expect(getSubjectFullName("MAC")).toBe("Management & Gestion");
    expect(getSubjectFullName("CONFERENCE DIVERS")).toBe("Conference Divers");
  });

  it("returns appropriate subject colors for light and dark modes", () => {
    const lightColors = getSubjectColors("IN101", false);
    expect(lightColors.background).toBe("var(--color-IN)");
    expect(lightColors.border).toBe("var(--border-IN)");

    const darkColors = getSubjectColors("IN101", true);
    expect(darkColors.background).toBe("var(--color-IN)");

    // Test non-Esisar / personal schedule course
    const ugaLight = getSubjectColors("Gouvernance SI", false);
    expect(ugaLight.background).toMatch(/^#/);
    expect(ugaLight.border).toMatch(/^#/);
    expect(ugaLight.text).toMatch(/^#/);

    const ugaDark = getSubjectColors("Gouvernance SI", true);
    expect(ugaDark.background).toMatch(/^#/);
    expect(ugaDark.border).toMatch(/^#/);
  });
});
