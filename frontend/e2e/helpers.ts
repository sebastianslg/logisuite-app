import { expect, type Page } from "@playwright/test";

/** Registra errores de página y de consola (salvo los conocidos del entorno sin GPU) para fallar al final. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // El worker de MapLibre y avisos de WebGL dependen del navegador sin GPU; un 404 de recurso es esperado en la página 404
    if (/Worker failed|luma\.gl|GPU stall|WebGL|status of 404/.test(t)) return;
    errors.push(`console ${page.url()}: ${t}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });
  return {
    errors,
    expectClean: () => expect(errors, errors.join("\n")).toEqual([]),
  };
}

export async function noHorizontalOverflow(page: Page) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(sw, `desborde horizontal en ${page.url()}`).toBeLessThanOrEqual(w);
}

export const PAGES = [
  "/",
  "/envios",
  "/envios/nuevo",
  "/red",
  "/vias",
  "/vias?ver=nodos",
  "/flota",
  "/flota?ver=mantenimiento",
  "/flota?ver=fallas",
  "/flota?ver=conductores",
  "/bodegas",
  "/bodegas?ver=traslados",
  "/combustible",
  "/huella",
  "/historial",
  "/configuracion",
];
