import { test, expect } from "@playwright/test";
import { FIXTURE } from "./global-setup.js";
import { openApp, expectNoHorizontalOverflow, goToTab, topBarTitle } from "./helpers.js";

const promoA = FIXTURE.promoA.replace(/\.ics$/, "");
const promoAQuery = new RegExp(`/\\?file=${encodeURIComponent(FIXTURE.promoA)}`);

test.describe("planning", () => {
  test("opens the first promo and shows its name in the top bar", async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveURL(promoAQuery);
    await expect(page.locator(".event", { hasText: FIXTURE.courseA }).first()).toBeVisible();
    await expect(topBarTitle(page)).toHaveText(promoA);
    await expect(page.getByRole("status").first()).toBeVisible();
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
  test("tabs switch screens and the Planning tab keeps the displayed schedule", async ({ page }) => {
    await openApp(page);
    await goToTab(page, "Rechercher");
    await expect(page).toHaveURL(/\/rechercher$/);
    await expect(topBarTitle(page)).toHaveText("Rechercher");

    await goToTab(page, "Planning");
    await expect(page).toHaveURL(promoAQuery);
    await expect(page.locator(".event", { hasText: FIXTURE.courseA }).first()).toBeVisible();
  });

  test("search opens a teacher on Planning; Back returns to search, then to the promo", async ({ page }) => {
    await openApp(page);
    await goToTab(page, "Rechercher");
    await page.getByRole("combobox", { name: /Rechercher un planning/ }).fill("DUPONT");
    await page.getByRole("option", { name: new RegExp(FIXTURE.teacher) }).click();

    await expect(page).toHaveURL(/\/\?teacher=DUPONT/);
    await expect(topBarTitle(page)).toHaveText(FIXTURE.teacher);
    // The teacher planning aggregates both promos.
    await expect(page.locator(".event", { hasText: FIXTURE.courseB }).first()).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/rechercher$/);
    await page.goBack();
    await expect(page).toHaveURL(promoAQuery);
    await expect(topBarTitle(page)).toHaveText(promoA);
  });

  test("the top bar back arrow returns from a room to my schedule", async ({ page }) => {
    await openApp(page);
    await page.locator(".event", { hasText: FIXTURE.courseA }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`Salle ${FIXTURE.room}`) }).click();
    await expect(page).toHaveURL(new RegExp(`room=${FIXTURE.room}`));
    await expect(topBarTitle(page)).toHaveText(`Salle ${FIXTURE.room}`);

    await page.getByRole("button", { name: "Revenir à mon planning" }).click();
    await expect(page).toHaveURL(promoAQuery);
    await expect(topBarTitle(page)).toHaveText(promoA);
  });

  test("free rooms screen opens a room schedule", async ({ page }) => {
    await openApp(page);
    await goToTab(page, "Salles libres");
    const firstRoom = page.locator(".room-card").first();
    await expect(firstRoom).toBeVisible();
    await firstRoom.click();
    await expect(page).toHaveURL(/\/\?room=/);
    await expect(topBarTitle(page)).toHaveText(/^Salle /);
  });

  test("shared links restore the schedule", async ({ page }) => {
    await openApp(page, `?file=${encodeURIComponent(FIXTURE.promoB)}`);
    await expect(page.locator(".event", { hasText: FIXTURE.courseB }).first()).toBeVisible();
    await expect(page.locator(".event", { hasText: FIXTURE.courseA })).toHaveCount(0);
  });

  test("deep links to a screen are kept on start-up", async ({ page }) => {
    await page.goto("/plus");
    await expect(page.getByText("À propos")).toBeVisible();
    await expect(page).toHaveURL(/\/plus/);
  });
});

test.describe("more screen", () => {
  test("offers schedule actions, display settings and about", async ({ page }) => {
    await openApp(page);
    await goToTab(page, "Plus");
    await expect(page.getByText("S'abonner dans mon agenda")).toBeVisible();
    await expect(page.getByText("Partager ce planning")).toBeVisible();
    await expect(page.getByText("Thème sombre")).toBeVisible();
    await expect(page.getByText("Menu du RU")).toBeVisible();
    await expect(page.getByText("Code source")).toBeVisible();
  });
});

test.describe("layout", () => {
  test("no horizontal overflow — Planning, Salles libres, Plus", async ({ page }, testInfo) => {
    await openApp(page);
    await expectNoHorizontalOverflow(page);
    await testInfo.attach("planning.png", { body: await page.screenshot(), contentType: "image/png" });

    for (const tab of ["Salles libres", "Plus"]) {
      await goToTab(page, tab);
      await expect(topBarTitle(page)).toHaveText(tab);
      await expectNoHorizontalOverflow(page);
      await testInfo.attach(`${tab}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }
  });

  for (const mode of ["Promos", "Profs", "Salles", "Mon ADE"]) {
    test(`no horizontal overflow — Rechercher / ${mode}`, async ({ page }, testInfo) => {
      await openApp(page);
      await goToTab(page, "Rechercher");
      const labels = { Promos: /Promos|Élèves/, Profs: /Profs|Professeurs/, Salles: /^Salles$/, "Mon ADE": /Mon ADE|Mon Planning ADE/ };
      await page.getByRole("tab", { name: labels[mode] }).click();
      if (mode === "Mon ADE") await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await testInfo.attach(`search-${mode}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });
  }

  test("no horizontal overflow — course details", async ({ page }) => {
    await openApp(page);
    await page.locator(".event").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("page title", async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveTitle(/ICSExplorer/);
  });
});
