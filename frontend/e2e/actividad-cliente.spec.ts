import { expect, test } from "./helpers";

/**
 * Actividad del cliente. Comprueba las dos reglas de `docs/ACTIVIDAD_CLIENTE.md` que no se ven a simple vista:
 *  - una sola petición por URL aunque varios componentes pidan el mismo dato, pausa real con la pestaña oculta,
 *    espera creciente tras un fallo y recuperación sin recargar;
 *  - si el equipo no puede dibujar WebGL, el mapa 3D deja la red plana con un reintento explícito que funciona
 *    cuando la GPU vuelve (aquí se simula quitando y devolviendo el contexto).
 */

test("sondeos: una petición por URL, en pausa con la pestaña oculta y recuperación tras un fallo", async ({ page }) => {
  // Reloj falso solo para no esperar 60 s reales. Se instala antes de navegar para que los temporizadores del
  // sondeo sean suyos; el resto de la página carga a velocidad normal.
  await page.clock.install();

  // La pestaña empieza visible y la prueba la oculta cuando toca (Playwright no trae un atajo para visibilityState).
  await page.addInitScript(() => {
    let oculta = false;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (oculta ? "hidden" : "visible"),
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => oculta,
    });
    (window as Window & { __ocultarPestana?: (v: boolean) => void }).__ocultarPestana = (v: boolean) => {
      oculta = v;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    // El resumen se queda en la vista plana: esta prueba mide sondeos, no el alta diferida del mapa 3D.
    try {
      localStorage.setItem("westvane.dashboard-map", "plano");
    } catch {
      /* origen opaco antes de navegar */
    }
  });

  // La primera lectura de avisos falla a propósito; las siguientes responden normal.
  let primera = true;
  await page.route("**/api/alerts", async (route) => {
    if (primera) {
      primera = false;
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });

  const peticiones: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/alerts") peticiones.push(request.url());
  });

  await page.goto("/panel");
  await expect.poll(() => peticiones.length, { message: "la campana y la hoja del dock deben compartir un solo sondeo" }).toBe(1);
  // El fallo se refleja en la campana (y deja programado el reintento) antes de mover el reloj.
  await expect(page.getByRole("button", { name: "Avisos: no se pudieron cargar" })).toBeVisible();
  await page.waitForTimeout(200);

  // Si dos suscriptores pidieran por su cuenta, la segunda petición llegaría en el mismo arranque.
  await page.clock.fastForward(2_000);
  expect(peticiones.length, "peticiones duplicadas de /api/alerts").toBe(1);

  // Pestaña oculta: ni el reintento del fallo (que espera 120 s) debe dispararse.
  await page.evaluate(() => (window as unknown as { __ocultarPestana: (v: boolean) => void }).__ocultarPestana(true));
  await page.clock.fastForward(300_000);
  expect(peticiones.length, "se sondeó con la pestaña oculta").toBe(1);

  // Al volver sigue el reintento con espera creciente: no hay una ráfaga inmediata.
  await page.evaluate(() => (window as unknown as { __ocultarPestana: (v: boolean) => void }).__ocultarPestana(false));
  await page.clock.fastForward(2_000);
  expect(peticiones.length, "la vuelta a la pestaña debe respetar la espera tras el fallo").toBe(1);

  // Pasados los 120 s del primer reintento, la lectura se recupera.
  const recuperada = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/alerts" && response.status() === 200);
  await page.clock.fastForward(120_000);
  await recuperada;
  expect(peticiones.length, "debía haber exactamente un reintento").toBe(2);

  // El panel deja el esqueleto y muestra los avisos reales (o «todo en orden»).
  await page.getByRole("button", { name: /^Avisos/ }).click();
  const panel = page.getByRole("region", { name: "Avisos operativos" });
  await expect(panel).toBeVisible();
  await expect(panel.locator(".skeleton")).toHaveCount(0);
  await expect(panel.getByText("No se pudieron cargar los avisos. Se reintenta solo.")).toHaveCount(0);
});

test("mapa 3D: sin WebGL queda la red plana y «Reintentar» la recupera", async ({ page }) => {
  // Se bloquea WebGL antes de que cargue nada; luego se devuelve para probar el reintento explícito.
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (type: string, ...args: unknown[]) => unknown;
    };
    const original = proto.getContext;
    let bloqueado = true;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (bloqueado && (type === "webgl" || type === "webgl2" || type === "experimental-webgl")) return null;
      return original.call(this, type, ...args);
    };
    (window as Window & { __devolverWebGL?: () => void }).__devolverWebGL = () => {
      bloqueado = false;
    };
  });

  await page.goto("/red");
  const aviso = page.getByRole("status").filter({ hasText: /no puede dibujar el mapa 3D/i });
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  // La red plana sigue ahí: no hay pantalla vacía ni error de página.
  await expect(page.locator('svg[aria-label^="Red multimodal"]').first()).toBeVisible();

  await page.evaluate(() => (window as unknown as { __devolverWebGL: () => void }).__devolverWebGL());
  await page.getByRole("button", { name: "Reintentar el mapa 3D" }).click();

  // El mapa base es opcional: lo que debe volver es el lienzo de deck.gl, no el de MapLibre.
  await expect(page.locator('[data-testid="mapa-colombia"][data-map-ready="1"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toHaveCount(0);
});
