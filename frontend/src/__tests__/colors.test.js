import { describe, it, expect } from "vitest";
import { getSubjectType, getDiscipline, getSubjectColors, getSubjectFullName, isRuEvent } from "../utils/colors.js";

describe("colors utils", () => {
  it("detects known subject types correctly (module-level and domains)", () => {
    expect(getSubjectType("IN101 Algo")).toBe("IN101");
    expect(getSubjectType("SN201 Signal")).toBe("SN201");
    expect(getSubjectType("LV01 Anglais")).toBe("LV01");
    expect(getSubjectType("PR301 Recherche")).toBe("PR301");
    expect(getSubjectType("TE510 Telecom")).toBe("TE510");
    expect(getSubjectType("PIN50 Projet")).toBe("PIN50");
    expect(getSubjectType("Cercle Soiree")).toBe("CERCLE");
    expect(getSubjectType("🍽️ RU Briff'O")).toBe("RU");
    expect(getSubjectType({ summary: "🍽️ RU Briff'O", isRu: true })).toBe("RU");
    expect(getSubjectType("CM - Management des Systèmes d'Information")).toBe("MANAGEMENT DES SYSTÈMES D'INFORMATION");
    expect(getSubjectType("TD Anglais Professionnel")).toBe("ANGLAIS PROFESSIONNEL");
    expect(getSubjectType("TP Développement Web")).toBe("DÉVELOPPEMENT WEB");
    expect(getSubjectType("Conférence Divers")).toBe("CONFÉRENCE DIVERS");
  });

  it("resolves discipline prefixes accurately", () => {
    expect(getDiscipline("IN101 Algo")).toBe("IN");
    expect(getDiscipline("TE510 Telecom")).toBe("TE");
    expect(getDiscipline("PIN50 Projet")).toBe("IN");
    expect(getDiscipline("AU331 Automatique")).toBe("AU");
    expect(getDiscipline("MT321 Maths")).toBe("MT");
    expect(getDiscipline("MAC")).toBe("MAC");
  });

  it("detects isRuEvent accurately", () => {
    expect(isRuEvent("🍽️ RU Briff'O")).toBe(true);
    expect(isRuEvent("Menu RU")).toBe(true);
    expect(isRuEvent({ isRu: true })).toBe(true);
    expect(isRuEvent({ categories: "RU,CROUS" })).toBe(true);
    expect(isRuEvent({ source: "RU Briff'O" })).toBe(true);
    expect(isRuEvent("IN101 Algo")).toBe(false);
  });

  it("returns human-readable subject names", () => {
    expect(getSubjectFullName("IN")).toBe("IN");
    expect(getSubjectFullName("IN101")).toBe("IN101");
    expect(getSubjectFullName("TE510")).toBe("TE510");
    expect(getSubjectFullName("SN")).toBe("SN");
    expect(getSubjectFullName("LV")).toBe("LV");
    expect(getSubjectFullName("CERCLE")).toBe("Cercle des Élèves");
    expect(getSubjectFullName("RU")).toBe("RU Briff'O (CROUS)");
    expect(getSubjectFullName("MAC")).toBe("MAC");
    expect(getSubjectFullName("CONFERENCE DIVERS")).toBe("CONFERENCE DIVERS");
  });

  it("returns appropriate subject colors for light and dark modes", () => {
    const lightColors = getSubjectColors("IN101", false);
    expect(lightColors.background).toBe("var(--color-IN)");
    expect(lightColors.border).toBe("var(--border-IN)");

    const darkColors = getSubjectColors("IN101", true);
    expect(darkColors.background).toBe("var(--color-IN)");

    // Test non-Esisar / personal schedule course
    const ugaLight = getSubjectColors("Gouvernance SI", false);
    expect(ugaLight.background).toMatch(/^rgba/);
    expect(ugaLight.border).toMatch(/^#/);
    expect(ugaLight.text).toMatch(/^#/);

    const ugaDark = getSubjectColors("Gouvernance SI", true);
    expect(ugaDark.background).toMatch(/^rgba/);
    expect(ugaDark.border).toMatch(/^#/);
  });

  it("ensures courses with identical titles or prefix variations always have the exact same color", () => {
    const course1 = getSubjectColors("***Strategic Management", false);
    const course2 = getSubjectColors("***Strategic Management", false);
    expect(course1).toEqual(course2);

    const bdd1 = getSubjectColors("Conception de bases de données", false);
    const bdd2 = getSubjectColors("CM Conception de bases de données", false);
    expect(bdd1).toEqual(bdd2);

    const web1 = getSubjectColors("Introduction aux technologies web", true);
    const web2 = getSubjectColors("TD Introduction aux technologies web - Groupe 1", true);
    expect(web1).toEqual(web2);
  });
});
