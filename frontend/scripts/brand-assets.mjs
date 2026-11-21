// Genera los íconos PNG de la marca a partir de src/app/icon.svg, con el mismo navegador de las pruebas (Playwright):
//   node scripts/brand-assets.mjs            (usa Chromium de Playwright)
//   BRAND_CHANNEL=msedge node scripts/brand-assets.mjs   (usa Edge instalado, sin descargar nada)
// Salidas: public/icon-192.png y public/icon-512.png (esquinas redondeadas, fondo transparente), public/icon-maskable-512.png
// (cuadro completo con la W dentro de la zona segura de Android) y src/app/apple-icon.png (180 px, cuadro completo: iOS
// redondea solo). Los PNG de 16, 32 y 48 px quedan en .brand-tmp/ y el favicon.ico se arma con Pillow (backend/.venv) (ver docs/BITACORA.md, sección 58).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const svg = await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8");
// Versión de cuadro completo: el mismo dibujo sin el radio y con la W reducida al 80 % (zona segura de los íconos adaptables)
const inner = svg.replace(/<svg[^>]*>/, "").replace("</svg>", "").replace(/<rect[^>]*\/>/, "");
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0071e3"/>` +
  `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${inner}</g></svg>`;

const jobs = [
  { out: "../public/icon-192.png", size: 192, markup: svg },
  { out: "../public/icon-512.png", size: 512, markup: svg },
  { out: "../public/icon-maskable-512.png", size: 512, markup: fullBleed(0.8) },
  { out: "../src/app/apple-icon.png", size: 180, markup: fullBleed(0.92) },
  { out: "../.brand-tmp/favicon-16.png", size: 16, markup: svg },
  { out: "../.brand-tmp/favicon-32.png", size: 32, markup: svg },
  { out: "../.brand-tmp/favicon-48.png", size: 48, markup: svg },
];

await mkdir(new URL("../.brand-tmp/", import.meta.url), { recursive: true });
const browser = await chromium.launch(process.env.BRAND_CHANNEL ? { channel: process.env.BRAND_CHANNEL } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { out, size, markup } of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await writeFile(new URL(out, import.meta.url), png);
  console.log(`${out} (${size} px)`);
}
await browser.close();
