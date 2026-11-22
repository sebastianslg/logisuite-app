import { expect, test } from "./helpers";

/**
 * Robustez de las lecturas cuando la red o el servidor fallan:
 *  - la paleta no se queda con datos vacíos para siempre: al reabrirla reintenta y conserva lo último válido;
 *  - el aviso de conexión pregunta al servidor al arrancar y al enfocar, sin sondas en ráfaga;
 *  - sin `AbortSignal.any` (Safari 15 y anteriores) las llamadas de `api()` y el aviso siguen funcionando.
 */

const DATOS_PALETA = [
  "/api/shipments?limit=100",
  "/api/locations",
  "/api/fleet/vehicles",
  "/api/warehouses",
  "/api/corridors",
];

test("la paleta reintenta sus datos al reabrir y conserva los que ya eran válidos", async ({ page }) => {
  const listado = await page.request.get("/api/shipments?limit=1");
  expect(listado.ok(), await listado.text()).toBe(true);
  const items = ((await listado.json()) as { items?: { code: string }[] }).items ?? [];
  expect(items.length, "hace falta al menos un envío en la base de pruebas").toBeGreaterThan(0);
  const codigo = items[0].code;

  await page.goto("/panel");
  await expect(page.getByRole("status").filter({ hasText: /Sistema en línea|Sin conexión/ }).first()).toBeVisible();

  let fallar = true;
  const llamadas = new Map<string, number>();
  const rutaDePaleta = (url: URL) => DATOS_PALETA.includes(url.pathname + url.search);

  await page.route(rutaDePaleta, async (route) => {
    const url = new URL(route.request().url());
    const clave = url.pathname + url.search;
    llamadas.set(clave, (llamadas.get(clave) ?? 0) + 1);
    if (fallar) await route.abort("connectionrefused");
    else await route.continue();
  });
  // La búsqueda del servidor no debe meter el envío por otra vía: esta prueba mira solo la lista local
  await page.route(
    (url) => url.pathname === "/api/search",
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], truncated: false }) }),
  );

  const abrirPaleta = async () => {
    await page.keyboard.press("Control+k");
    const dialogo = page.getByRole("dialog", { name: "Buscar o ejecutar un comando" });
    await expect(dialogo).toBeVisible();
    return dialogo;
  };

  // Primera apertura: las cinco listas fallan y el envío no puede aparecer
  let dialogo = await abrirPaleta();
  // La paleta sigue sirviendo para los comandos
  await expect(dialogo.getByRole("option").filter({ hasText: "Resumen" })).toBeVisible();
  await expect.poll(() => DATOS_PALETA.every((clave) => (llamadas.get(clave) ?? 0) > 0), { timeout: 10_000 }).toBe(true);
  await dialogo.getByRole("combobox").fill(codigo);
  await page.waitForTimeout(250);
  await expect(dialogo.getByRole("option").filter({ hasText: codigo })).toHaveCount(0);

  // Cerrar desmonta la lista; al reabrir con la red arreglada se vuelven a pedir las cinco listas
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  const antesDelReintento = new Map(llamadas);
  fallar = false;
  dialogo = await abrirPaleta();
  await expect
    .poll(
      () => DATOS_PALETA.every((clave) => (llamadas.get(clave) ?? 0) > (antesDelReintento.get(clave) ?? 0)),
      { timeout: 10_000 },
    )
    .toBe(true);
  await dialogo.getByRole("combobox").fill(codigo);
  await expect(dialogo.getByRole("option").filter({ hasText: codigo })).toBeVisible();

  // Con datos completos en el módulo, reabrir con la red caída no los borra ni vuelve a pedirlos
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  fallar = true;
  const antesDeLaTercera = new Map(llamadas);
  dialogo = await abrirPaleta();
  await dialogo.getByRole("combobox").fill(codigo);
  await expect(dialogo.getByRole("option").filter({ hasText: codigo })).toBeVisible();
  await page.waitForTimeout(300);
  expect(
    DATOS_PALETA.filter((clave) => (llamadas.get(clave) ?? 0) !== (antesDeLaTercera.get(clave) ?? 0)),
    "una paleta completa no necesita volver a pedir los datos",
  ).toEqual([]);
});

test("el aviso de conexión comprueba el servidor al arrancar y al enfocar", async ({ page }) => {
  let salud = 503;
  let sondeos = 0;
  await page.route("**/api/health", async (route) => {
    sondeos += 1;
    await route.fulfill({
      status: salud,
      contentType: "application/json",
      body: JSON.stringify(salud === 200 ? { status: "ok" } : { detail: "sin servidor" }),
    });
  });

  // Al arrancar se pregunta al servidor: un 503 se ve como «Reintentar», no como si todo estuviera bien
  await page.goto("/panel");
  const aviso = page.locator("[data-conexion]:visible");
  await expect(aviso.first()).toBeVisible();
  await expect(aviso.first().getByRole("button", { name: "Reintentar" })).toBeVisible();

  // El botón vuelve a probar y el aviso desaparece cuando el servidor responde
  salud = 200;
  await aviso.first().getByRole("button", { name: "Reintentar" }).click();
  await expect(page.locator("[data-conexion]:visible")).toHaveCount(0);

  // Dos focos seguidos dentro de la ventana de ráfaga: una sola sonda más
  await page.waitForTimeout(1_100);
  const antesDelFoco = sondeos;
  const sondaDelFoco = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/health");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
  });
  expect((await sondaDelFoco).status()).toBe(200);
  await page.waitForTimeout(100);
  expect(sondeos - antesDelFoco, "dos focos seguidos deben producir una sola sonda").toBe(1);

  // Si el servidor se cae con la página abierta, recuperar el foco lo detecta sin recargar
  salud = 503;
  await page.waitForTimeout(1_100);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("[data-conexion]:visible").first()).toBeVisible();
});

test("sin AbortSignal.any (Safari viejo) la API responde y no quedan señales colgando", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.addInitScript(() => {
    // Safari 15 y anteriores no traen AbortSignal.any: `api()` y el aviso combinan las señales a mano
    delete (AbortSignal as unknown as { any?: unknown }).any;
  });

  const sesiones = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/sessions" && r.request().method() === "GET",
  );
  await page.goto("/configuracion");
  expect(
    await page.evaluate(() => typeof (AbortSignal as unknown as { any?: unknown }).any),
    "la prueba necesita simular un Safari sin AbortSignal.any",
  ).toBe("undefined");

  // Mis sesiones llama a `api()` dos veces al montar: /api/auth/me y /api/auth/sessions
  const respuesta = await sesiones;
  expect(respuesta.status()).toBe(200);
  const cuerpo = (await respuesta.json()) as { items?: unknown };
  expect(Array.isArray(cuerpo.items)).toBe(true);
  expect(errores, errores.join("\n")).toEqual([]);
});
