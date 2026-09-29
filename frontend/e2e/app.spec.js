import { test, expect } from "@playwright/test";
import { FIXTURE } from "./global-setup.js";
import { openApp, expectNoHorizontalOverflow, goToTab, topBarTitle, isMobile } from "./helpers.js";

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

const mondayOfThisWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
};
const longDay = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

test.describe("native planning grid", () => {
  test("swiping past Friday in the 1-day view moves to the next week and re-centres", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Vue jour" }).click();
    const scroller = page.locator(".grid-scroller");

    // Native horizontal scroll to Tuesday of next week (6 days after Monday).
    await scroller.evaluate((el) => {
      const colW = el.clientWidth - 44;
      const monday = [...el.querySelectorAll(".day-col")].findIndex((c) => c.classList.contains("week-start") && c.offsetLeft > 0 && c.offsetLeft - 44 >= el.scrollLeft - 5);
      el.scrollTo({ left: (monday + 6) * colW - 0, behavior: "instant" });
    });

    const tuesdayNextWeek = mondayOfThisWeek();
    tuesdayNextWeek.setDate(tuesdayNextWeek.getDate() + 8);
    await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("aria-label", longDay(tuesdayNextWeek));

    // Re-centred: the displayed day sits in the middle week of the rendered window.
    const index = await scroller.evaluate((el) => Math.round(el.scrollLeft / (el.clientWidth - 44)));
    expect(index).toBeGreaterThanOrEqual(5);
    expect(index).toBeLessThan(10);
  });

  test("the 5-day view pages by week and column headers open a day", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Vue semaine" }).click();
    await page.getByRole("button", { name: "Semaine suivante" }).click();
    const nextMonday = mondayOfThisWeek();
    nextMonday.setDate(nextMonday.getDate() + 7);
    const label = nextMonday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    await expect(page.locator(".period-btn")).toContainText(label);

    await page.getByRole("button", { name: `Afficher ${longDay(nextMonday)}` }).click();
    await expect(page.getByRole("button", { name: "Vue jour" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the whole day fits on a phone without vertical scrolling", async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), "phone layout");
    await openApp(page);
    await page.getByRole("button", { name: "Vue jour" }).click();
    const { client, scroll } = await page.locator(".grid-scroller").evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
    expect(scroll).toBeLessThanOrEqual(client + 1);
  });

  test("a floating 'Aujourd'hui' button appears away from today and brings you back", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Vue jour" }).click();
    const fab = page.getByRole("button", { name: "Aujourd'hui" });
    await page.getByRole("button", { name: "Semaine suivante" }).or(page.getByRole("button", { name: "Jour suivant" })).first().click();
    await page.getByRole("button", { name: "Jour suivant" }).click();
    await expect(fab).toBeVisible();
    await fab.click();
    await expect(fab).toHaveCount(0);
  });

  test("course details open in a sheet and close with Escape", async ({ page }) => {
    await openApp(page);
    await page.locator(".event:visible", { hasText: FIXTURE.courseA }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(FIXTURE.courseA);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
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
