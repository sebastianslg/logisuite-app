// Imagen para compartir el enlace (WhatsApp, LinkedIn, correo): 1200 x 630, con la marca, el titular de la presentación y
// los cinco modos con sus kilómetros reales de la red. Se genera con el mismo navegador de las pruebas:
//   BRAND_CHANNEL=msedge node scripts/og-image.mjs
// Salida: src/app/opengraph-image.png (Next la publica como og:image de todas las páginas).
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const font = await readFile(new URL("../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", import.meta.url));
const icon = await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8");

// Kilómetros de la red por modo (los mismos que muestra la presentación; actualizar si cambia la red)
const MODES = [
  ["Carretera", "12.628 km", "#2b7a3d"],
  ["Río", "4.480 km", "#2d9fbf"],
  ["Mar", "3.340 km", "#5252aa"],
  ["Aire", "13.437 km", "#dd668d"],
  ["Tren", "1.464 km", "#bb8912"],
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #f6f7f9; color: #161920; font-family: Inter, sans-serif; padding: 64px 72px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
.brand svg { width: 52px; height: 52px; }
h1 { margin-top: 56px; font-size: 68px; line-height: 1.02; font-weight: 600; letter-spacing: -0.04em; max-width: 900px; }
p { margin-top: 20px; font-size: 26px; color: #5f5f64; letter-spacing: -0.01em; }
.modes { margin-top: auto; display: grid; grid-template-columns: repeat(5, 1fr); background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 20px; overflow: hidden; }
.m { padding: 18px 22px; border-left: 1px solid rgba(0,0,0,.08); }
.m:first-child { border-left: none; }
.m b { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 500; color: #5f5f64; }
.m b i { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
.m span { display: block; margin-top: 6px; font-size: 28px; font-weight: 600; letter-spacing: -0.03em; }
</style></head><body>
<div class="brand">${icon}Westvane</div>
<h1>Su operación multimodal, sobre la red real de Colombia.</h1>
<p>Sistema de gestión de transporte para operadores logísticos.</p>
<div class="modes">${MODES.map(([n, km, c]) => `<div class="m"><b><i style="background:${c}"></i>${n}</b><span>${km}</span></div>`).join("")}</div>
</body></html>`;

const browser = await chromium.launch(process.env.BRAND_CHANNEL ? { channel: process.env.BRAND_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await writeFile(new URL("../src/app/opengraph-image.png", import.meta.url), await page.screenshot({ type: "png" }));
await browser.close();
console.log("src/app/opengraph-image.png (1200 x 630)");
