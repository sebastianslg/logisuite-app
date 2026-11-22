import { expect, test, watchErrors } from "./helpers";

/**
 * Inicio vacío (una empresa nueva) e impresión limpia de las listas.
 *
 * Las tres listas se leen en el servidor (Server Components): `page.route` no puede interceptar su respuesta, así
 * que el «sistema sin registros» se comprueba por el lado alcanzable: un filtro de la URL que no deja resultados
 * NO es el inicio vacío (tiene que seguir el aviso de siempre, con «Quitar filtros»). El inicio vacío en sí es el
 * componente presentacional `EmptyStart` con la función pura `isStartEmpty`, que solo se ve con la base vacía.
 *
 * La impresión se comprueba con la media de papel: sin dock ni pestañas, sin los botones de la cabecera, con el
 * encabezado de impresión (Westvane · título · fecha) y la lista con filas. El PDF solo confirma que no lanza.
 */

const INICIO = "[data-empty-start]";

test("en papel: cumplimiento y hoja de vida sin dock ni acciones de edición", async ({ page }) => {
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  const { items } = await (await page.request.get("/api/fleet/vehicles")).json() as { items: { id: number }[] };
  expect(items.length).toBeGreaterThan(0);
  for (const ruta of ["/hoy", `/flota/${items[0].id}`]) {
    await page.goto(ruta);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.getByRole("navigation", { name: "Navegación principal", exact: true })).toHaveCount(0);
    if (ruta === "/hoy") await expect(page.locator("#cumplimiento-t")).toBeVisible();
    else {
      await expect(page.getByRole("heading", { name: "Mantenimientos", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Editar", exact: true })).toHaveCount(0);
    }
  }
});

test("envíos: una búsqueda sin resultados no es el inicio vacío", async ({ page, request }) => {
  const w = watchErrors(page);
  const { total } = (await (await request.get("/api/shipments?limit=1")).json()) as { total: number };
  test.skip(total === 0, "la base de pruebas no tiene envíos");

  // Hay envíos en el sistema: un filtro que no deja ninguno no puede parecer una empresa nueva
  await page.goto("/envios?q=zzzz-no-existe");
  await expect(page.getByText("Ningún envío coincide").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Quitar filtros" })).toBeVisible();
  await expect(page.locator(`${INICIO}:visible`)).toHaveCount(0);

  // Y al quitarlo vuelven los envíos: nunca fue un inicio vacío
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page.locator("table tbody a[data-code]").first()).toBeVisible();
  await expect(page.getByText("Ningún envío coincide")).toHaveCount(0);
  w.expectClean();
});

test("flota: una búsqueda sin resultados no es el inicio vacío", async ({ page, request }) => {
  const w = watchErrors(page);
  const { items } = (await (await request.get("/api/fleet/vehicles")).json()) as { items: unknown[] };
  test.skip(items.length === 0, "la base de pruebas no tiene vehículos");

  await page.goto("/flota?q=zzzz-no-existe");
  await expect(page.getByText("Ningún vehículo coincide")).toBeVisible();
  await expect(page.getByRole("button", { name: "Quitar filtros" }).first()).toBeVisible();
  await expect(page.locator(`${INICIO}:visible`)).toHaveCount(0);

  await page.getByRole("button", { name: "Quitar filtros" }).first().click();
  await expect(page.locator("main ul.rule-list a[href^='/flota/']").first()).toBeVisible();
  w.expectClean();
});

test("bodegas: una búsqueda sin resultados no es el inicio vacío", async ({ page, request }) => {
  const w = watchErrors(page);
  const { items } = (await (await request.get("/api/warehouses")).json()) as { items: unknown[] };
  test.skip(items.length === 0, "la base de pruebas no tiene bodegas");

  await page.goto("/bodegas?q=zzzz-no-existe");
  await expect(page.getByText("Ninguna bodega coincide")).toBeVisible();
  await expect(page.getByRole("button", { name: "Quitar filtros" }).first()).toBeVisible();
  await expect(page.locator(`${INICIO}:visible`)).toHaveCount(0);

  await page.getByRole("button", { name: "Quitar filtros" }).first().click();
  await expect(page.locator("a.row-link[href^='/bodegas/']").first()).toBeVisible();
  w.expectClean();
});

type CasoImpresion = {
  nombre: string;
  url: string;
  api: string;
  total: (json: unknown) => number;
  titulo: string;
  /** Botón de creación de la cabecera: no debe salir en el papel. */
  crear: string;
  /** Botón de carga/importación de la cabecera: tampoco. */
  importar: RegExp;
  /** Selector de una fila de la lista. */
  filas: string;
};

const CASOS: CasoImpresion[] = [
  {
    nombre: "envíos",
    url: "/envios",
    api: "/api/shipments?limit=1",
    total: (json) => (json as { total: number }).total,
    titulo: "Envíos multimodales",
    crear: "/envios/nuevo",
    importar: /^Importar$/,
    filas: "table tbody tr",
  },
  {
    nombre: "flota",
    url: "/flota",
    api: "/api/fleet/vehicles",
    total: (json) => (json as { items: unknown[] }).items.length,
    titulo: "Flota de vehículos",
    crear: "/flota/nuevo",
    importar: /^Cargar$/,
    filas: "main ul.rule-list a[href^='/flota/']",
  },
  {
    nombre: "bodegas",
    url: "/bodegas",
    api: "/api/warehouses",
    total: (json) => (json as { items: unknown[] }).items.length,
    titulo: "Bodegas y centros de distribución",
    crear: "/bodegas/nueva",
    importar: /^Cargar$/,
    filas: "a.row-link[href^='/bodegas/']",
  },
];

for (const caso of CASOS) {
  test(`impresión: ${caso.nombre} sale sin dock ni botones, con encabezado y filas`, async ({ page, request }) => {
    const w = watchErrors(page);
    const datos = await (await request.get(caso.api)).json();
    test.skip(caso.total(datos) === 0, `la base de pruebas no tiene ${caso.nombre}`);

    // Media de papel desde la carga, como al pulsar Ctrl P
    await page.emulateMedia({ media: "print" });
    await page.goto(caso.url);

    // El dock (escritorio y celular) y las pestañas de sección no van al papel
    await expect(page.locator('nav[aria-label="Navegación principal"]')).toBeHidden();
    await expect(page.locator('nav[aria-label="Navegación principal (celular)"]')).toBeHidden();
    await expect(page.locator('nav[aria-label^="Secciones de"]')).toBeHidden();

    // Los botones de la cabecera de pantalla (crear e importar) tampoco
    await expect(page.locator(`main a[href="${caso.crear}"]`)).toBeHidden();
    await expect(page.getByRole("button", { name: caso.importar, includeHidden: true }).first()).toBeHidden();

    // Encabezado de impresión: marca, título de la pantalla y fecha en es-CO (se escribe al hidratar)
    const encabezado = page.locator("[data-print-header]");
    await expect(encabezado).toBeVisible();
    await expect(encabezado).toContainText("Westvane");
    await expect(encabezado).toContainText(caso.titulo);
    await expect(encabezado).toContainText(/\d{4}/);

    // La lista sigue en el papel, con sus filas
    await expect(page.locator(caso.filas).first()).toBeVisible();

    // El PDF se genera (solo se comprueba que no lanza; no se guarda ni se adjunta)
    const pdf = await page.pdf();
    expect(pdf.length).toBeGreaterThan(0);

    w.expectClean();
  });
}
