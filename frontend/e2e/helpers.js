import { expect } from "@playwright/test";

/**
 * Lists elements sticking out of the viewport horizontally. Elements inside
 * an intentional scroll/clip container are ignored, and the global
 * `overflow-x: clip` safety net on html/body is not counted, so this catches
 * the real offenders.
 */
export const findHorizontalOverflow = (page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (!r.width || (r.right <= vw + 1 && r.left >= -1)) continue;
      let parent = el.parentElement;
      let clipped = false;
      while (parent && parent !== document.body) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowX)) {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!clipped) {
        const cls = String(el.className?.baseVal ?? el.className).split(" ")[0];
        offenders.push(`${el.tagName.toLowerCase()}.${cls} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
    }
    return offenders.slice(0, 10);
  });

export const expectNoHorizontalOverflow = async (page) => {
  expect(await findHorizontalOverflow(page), "elements overflowing the viewport").toEqual([]);
};

/** Opens the app and waits until the schedule grid shows events. */
export const openApp = async (page, query = "") => {
  await page.goto(`/${query}`);
  await expect(page.locator(".event").first()).toBeVisible();
};

export const isMobile = (testInfo) => testInfo.project.name !== "desktop-chromium";

/** Clicks a destination in the main navigation (tab bar on phones, rail on desktop). */
export const goToTab = (page, label) =>
  page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name: label, exact: true }).click();

export const topBarTitle = (page) => page.locator(".top-bar-title");

/** Waits for the CSS transitions/animations running inside an element (e.g. a screen sliding in). */
export const settleAnimations = (locator) =>
  locator.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity) // spinners never finish
        .map((a) => a.finished.catch(() => {}))
    )
  );
