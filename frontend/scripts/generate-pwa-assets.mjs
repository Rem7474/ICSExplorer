// Generates the iOS home-screen assets from public/icon-maskable-512.png:
//   - public/apple-touch-icon.png (180×180, the size iOS asks for)
//   - public/splash/*.png, the launch screens iOS shows while the app starts
//     (iOS ignores the manifest for this and needs one exact-size image per
//     screen, selected with a media query).
// Run with `npm run pwa-assets`, then keep index.html's <link> tags in sync
// with the list printed at the end.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");
const splashDir = path.join(publicDir, "splash");

// Portrait CSS size and pixel ratio of each iPhone screen.
export const IPHONE_SCREENS = [
  { w: 375, h: 667, dpr: 2 }, // SE 2/3, 8
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14, 16e
  { w: 428, h: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { w: 402, h: 874, dpr: 3 }, // 16 Pro, 17, 17 Pro
  { w: 420, h: 912, dpr: 3 }, // Air
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max, 17 Pro Max
];

const BRAND = "#1e3a8a";
const icon = `data:image/png;base64,${fs.readFileSync(path.join(publicDir, "icon-maskable-512.png")).toString("base64")}`;

const splashHtml = `<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:22px;background:${BRAND};
  font-family:-apple-system,'SF Pro Display','Segoe UI',Roboto,sans-serif">
  <img src="${icon}" style="width:112px;height:112px;border-radius:25px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
  <div style="color:#fff;font-size:26px;font-weight:700;letter-spacing:.2px">ICSExplorer</div>
</body></html>`;

const browser = await chromium.launch();
try {
  fs.mkdirSync(splashDir, { recursive: true });
  const links = [];
  for (const { w, h, dpr } of IPHONE_SCREENS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await page.setContent(splashHtml);
    const file = `iphone-${w * dpr}x${h * dpr}.png`;
    await page.screenshot({ path: path.join(splashDir, file) });
    await page.close();
    links.push(
      `<link rel="apple-touch-startup-image" href="/splash/${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`
    );
  }

  const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await page.setContent(`<body style="margin:0"><img src="${icon}" style="width:180px;height:180px;display:block"></body>`);
  await page.screenshot({ path: path.join(publicDir, "apple-touch-icon.png") });

  console.log(links.join("\n"));
} finally {
  await browser.close();
}
