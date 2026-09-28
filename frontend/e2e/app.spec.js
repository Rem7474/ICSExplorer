import { test, expect } from "@playwright/test";
import { FIXTURE } from "./global-setup.js";
import { openApp, expectNoHorizontalOverflow } from "./helpers.js";

test.describe("planning", () => {
  test("opens the first promo and shows the week", async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveURL(new RegExp(`file=${encodeURIComponent(FIXTURE.promoA)}`));
    await expect(page.locator(".event", { hasText: FIXTURE.courseA }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "ICSExplorer" })).toBeVisible();
  });

  test("shows course details with room and teacher shortcuts", async ({ page }) => {
    await openApp(page);
    await page.locator(".event", { hasText: FIXTURE.courseA }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(FIXTURE.courseA);
    await expect(dialog.getByRole("button", { name: new RegExp(`Salle ${FIXTURE.room}`) })).toBeVisible();
    await expect(dialog.getByRole("button", { name: new RegExp(FIXTURE.teacher) })).toBeVisible();
  });

  test("courses expose a spoken label", async ({ page }) => {
    await openApp(page);
    const label = await page.locator(".event", { hasText: FIXTURE.courseA }).first().getAttribute("aria-label");
    expect(label).toContain(FIXTURE.courseA);
    expect(label).toContain(`salle ${FIXTURE.room}`);
  });
});

test.describe("navigation", () => {
  test("quick search opens a teacher, Back returns to the promo", async ({ page }) => {
    await openApp(page);
    const search = page.getByRole("combobox", { name: /Rechercher un planning/ });
    await search.fill("DUPONT");
    await page.getByRole("option", { name: new RegExp(FIXTURE.teacher) }).click();

    await expect(page).toHaveURL(/teacher=DUPONT/);
    // The teacher planning aggregates both promos.
    await expect(page.locator(".event", { hasText: FIXTURE.courseB }).first()).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`file=${encodeURIComponent(FIXTURE.promoA)}`));
    await expect(page.getByRole("tab", { name: /Promos|Élèves/ })).toHaveAttribute("aria-selected", "true");
  });

  test("room schedule opens from the course details", async ({ page }) => {
    await openApp(page);
    await page.locator(".event", { hasText: FIXTURE.courseA }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`Salle ${FIXTURE.room}`) }).click();
    await expect(page).toHaveURL(new RegExp(`room=${FIXTURE.room}`));
    await expect(page.locator(".event").first()).toBeVisible();
  });

  test("shared links restore the schedule", async ({ page }) => {
    await openApp(page, `?file=${encodeURIComponent(FIXTURE.promoB)}`);
    await expect(page.locator(".event", { hasText: FIXTURE.courseB }).first()).toBeVisible();
    await expect(page.locator(".event", { hasText: FIXTURE.courseA })).toHaveCount(0);
  });
});

test.describe("layout", () => {
  for (const mode of ["Promos", "Profs", "Salles", "Mon ADE"]) {
    test(`no horizontal overflow — ${mode}`, async ({ page }, testInfo) => {
      await openApp(page);
      const labels = { Promos: /Promos|Élèves/, Profs: /Profs|Professeurs/, Salles: /Salles/, "Mon ADE": /Mon ADE|Mon Planning ADE/ };
      await page.getByRole("tab", { name: labels[mode] }).click();
      if (mode === "Mon ADE") await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await testInfo.attach(`${mode}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });
  }

  test("no horizontal overflow — free rooms and course details", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: /salles libres/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");

    await page.locator(".event").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("header reports the app name and a freshness badge", async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole("status").first()).toBeVisible();
    await expect(page).toHaveTitle(/ICSExplorer/);
    await expect(page.locator(".footer")).toContainText("ICSExplorer");
  });
});
