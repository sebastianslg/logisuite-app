import { expect, test } from "./helpers";

/**
 * El primer pliegue tiene que estar pintado desde el HTML del servidor. El encabezado de página era el LCP de
 * `/panel` y de las listas (2,8 s con CPU ×4) porque lo envolvía `Reveal`, un componente cliente que el servidor
 * pinta con `opacity: 0` y que solo lo destapaba al hidratar.
 *
 * Se comprueba de dos formas:
 *  - el HTML del servidor no trae `opacity: 0` en el encabezado de la página;
 *  - con JavaScript desactivado, el título y todos sus contenedores hasta `.page` tienen opacidad 1 (así una
 *    envoltura cliente nueva vuelve a fallar aquí, no solo cuando alguien mide el LCP).
 *
 * El fundido de la vista (`app/template.tsx`) queda fuera de este alcance: también llega con `opacity: 0` y es
 * el siguiente obstáculo para que el primer HTML se pinte sin hidratar.
 *
 * La cookie de la sesión basta para recibir el HTML de las dos páginas: la opacidad del encabezado no depende de
 * que el navegador ejecute JavaScript.
 */
test("el encabezado de panel y ficha llega pintado sin JavaScript", async ({ browser, page, baseURL }) => {
  test.setTimeout(90_000);

  // Un envío real para abrir su ficha con la cookie de la cuenta «pruebas»
  const list = await page.request.get("/api/shipments?limit=1");
  expect(list.ok(), await list.text()).toBe(true);
  const code = ((await list.json()) as { items: { code: string }[] }).items[0].code;

  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport: { width: 1400, height: 900 },
  });
  try {
    // Misma sesión que el navegador de la prueba (la cookie es HttpOnly; se copia tal cual)
    await context.addCookies(await page.context().cookies());

    for (const [path, nombre, titulo] of [
      ["/panel", "el panel", "Torre de control"],
      [`/envios/${code}`, "la ficha del envío", code],
    ] as const) {
      const noJs = await context.newPage();
      try {
        const response = await noJs.goto(path);
        expect(response?.status(), `${nombre}: ${path}`).toBe(200);
        expect(new URL(response!.url()).pathname, `${nombre}: la sesión no sirvió y se sirvió otra ruta`).toBe(path);

        // El <header> de la página (el primero dentro de <main>) no puede traer opacidad en el HTML del servidor
        const html = await response!.text();
        const mainAt = html.indexOf('<main id="contenido"');
        expect(mainAt, `${nombre}: no hay <main> en el HTML`).toBeGreaterThan(-1);
        const main = html.slice(mainAt);
        const headerAt = main.indexOf("<header");
        expect(headerAt, `${nombre}: no hay <header> en el HTML`).toBeGreaterThan(-1);
        const header = main.slice(headerAt, main.indexOf("</header>", headerAt) + "</header>".length);
        expect(header, `${nombre}: el encabezado llega con opacity 0 al HTML del servidor`).not.toMatch(/style="[^"]*opacity:\s*0/);

        // Y renderizado sin JavaScript: el título y sus contenedores dentro de la página no pueden ser transparentes.
        // (El contenido en suspenso llega en un segmento oculto fuera de <main>; sin JS queda ahí, pero su HTML es el del servidor.)
        const title = noJs.locator("h1").filter({ hasText: titulo }).first();
        await expect(title, `${nombre}: falta el título en el HTML`).toHaveCount(1);
        const opacidades = await title.evaluate((el) => {
          const root = el.closest(".page");
          let min = 1;
          const transparentes: string[] = [];
          for (let node: Element | null = el; node; node = node.parentElement) {
            const value = Number.parseFloat(getComputedStyle(node).opacity);
            if (value < 1) {
              const cls = (node.getAttribute("class") ?? "").split(" ").filter(Boolean).slice(0, 3).join(".");
              transparentes.push(`${node.tagName.toLowerCase()}${cls ? `.${cls}` : ""} (${value})`);
            }
            min = Math.min(min, value);
            if (node === root) break;
          }
          return { min, transparentes, page: !!root };
        });
        // La ficha llega en un segmento transmitido fuera de .page (sin JavaScript queda oculto): su opacidad ya se
        // comprobó arriba sobre el HTML del servidor; el recorrido de contenedores se hace en el panel.
        if (path === "/panel") {
          expect(opacidades.page, `${nombre}: el título no está dentro de .page`).toBe(true);
          expect(
            opacidades.min,
            `${nombre}: el título queda dentro de algo transparente sin JavaScript: ${opacidades.transparentes.join(" · ")}`,
          ).toBe(1);
        }
        const headerOpacidad = await title.evaluate((el) => {
          const header = el.closest("header");
          return header ? Number.parseFloat(getComputedStyle(header).opacity) : null;
        });
        if (headerOpacidad !== null) expect(headerOpacidad, `${nombre}: el <header> tiene opacidad 0`).toBe(1);
      } finally {
        await noJs.close();
      }
    }
  } finally {
    await context.close();
  }
});
