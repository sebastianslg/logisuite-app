import { expect, test as base, type Page } from "@playwright/test";

export { expect };

/** Navegador de prueba que ya aceptó términos y privacidad (el flujo de aceptación tiene su propia prueba). */
export const E2E_BROWSER = "nav-e2e-00000000000000000001";

export const test = base.extend({
  page: async ({ page, baseURL }, provide) => {
    const legal = await (await page.request.get(`${baseURL}/api/legal`)).json();
    await page.request.post(`${baseURL}/api/consents`, {
      data: {
        browser_id: E2E_BROWSER,
        subject: "Pruebas",
        context: "primer_uso",
        items: ["terminos", "privacidad"].map((d) => ({ document: d, version: legal.versions[d], text: `Prueba automática: acepta ${d}` })),
      },
    });
    await page.addInitScript((id) => localStorage.setItem("westvane.browser-id", id), E2E_BROWSER);
    await provide(page);
  },
});

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
  // En celular el navegador ensancha la ventana de diseño hasta el contenido que desborda (innerWidth crece con él):
  // se compara contra el ancho de la pantalla del dispositivo.
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: Math.min(window.innerWidth, screen.width) }));
  expect(sw, `desborde horizontal en ${page.url()}`).toBeLessThanOrEqual(w);
}

export const PAGES = [
  "/",
  "/envios",
  "/envios/nuevo",
  "/hoy",
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
  "/metodologia",
  "/creditos",
  "/terminos",
  "/privacidad",
  "/cookies",
  "/calendario",
  "/clientes",
  "/comparar",
  "/cotizacion?origen=Leticia&destino=Cartagena&peso=5",
];
