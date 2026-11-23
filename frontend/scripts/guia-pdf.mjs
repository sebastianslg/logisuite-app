// Genera la guía en PDF a partir de docs/entrega/guia.html, con el navegador de las pruebas:
//   BRAND_CHANNEL=msedge node scripts/guia-pdf.mjs
// Salidas:
//   docs/entrega/Westvane-Guia-de-revision.pdf   (versionada: la contraseña dice «se entrega aparte»)
//   entrega/Westvane-Guia-de-revision.pdf         (NO versionada, carpeta en .gitignore: con la contraseña de la cuenta
//                                                  «profesor», leída de backend/data/acceso-profesor.txt)
// Nunca se escribe una contraseña en un archivo que vaya a git.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = path.join(root, "docs/entrega/guia.html");
const secretFile = path.join(root, "backend/data/acceso-profesor.txt");
const secret = existsSync(secretFile)
  ? (readFileSync(secretFile, "utf8").match(/^Contraseña:\s*(.+)$/m)?.[1] ?? "").trim()
  : "";

const browser = await chromium.launch(process.env.BRAND_CHANNEL ? { channel: process.env.BRAND_CHANNEL } : {});
async function render(out, clave) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
  await page.evaluate((c) => { document.body.innerHTML = document.body.innerHTML.replaceAll("{{CLAVE}}", c); }, clave);
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
  await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: '<div style="font-size:8px;color:#8e8e93;width:100%;text-align:center;font-family:Segoe UI,sans-serif">Westvane TMS · Guía de revisión · <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
  await page.close();
  console.log(out);
}
await render(path.join(root, "docs/entrega/Westvane-Guia-de-revision.pdf"), "se entrega aparte");
if (secret) {
  mkdirSync(path.join(root, "entrega"), { recursive: true });
  await render(path.join(root, "entrega/Westvane-Guia-de-revision.pdf"), secret);
} else {
  console.log("Sin backend/data/acceso-profesor.txt: solo se generó la versión sin contraseña.");
}
await browser.close();
