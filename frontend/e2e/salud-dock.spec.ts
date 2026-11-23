import type { Page } from "@playwright/test";

import { expect, test } from "./helpers";

/**
 * Un solo sondeo de salud para el dock. El punto del escritorio y el texto de la hoja «Más» del celular leen el
 * mismo almacén de /api/health: abrir la hoja no agrega otra petición y no queda un segundo intervalo de 30 s.
 * Se cuentan las peticiones en la ruta para no depender solo de lo que diga la pantalla.
 */

const ESTADO = /Sistema en línea|Sin conexión/;

type Sondeos = { total: number; enVuelo: number; maxEnVuelo: number };

/** Intercepta /api/health, responde sano con una demora breve y cuenta peticiones y cruces. */
async function contarSondeos(page: Page): Promise<Sondeos> {
  const cuenta: Sondeos = { total: 0, enVuelo: 0, maxEnVuelo: 0 };
  await page.route("**/api/health", async (route) => {
    cuenta.total += 1;
    cuenta.enVuelo += 1;
    cuenta.maxEnVuelo = Math.max(cuenta.maxEnVuelo, cuenta.enVuelo);
    try {
      // La demora deja ver si dos widgets piden a la vez; con una respuesta instantánea el cruce pasaría inadvertido.
      await new Promise((listo) => setTimeout(listo, 150));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
    } finally {
      cuenta.enVuelo -= 1;
    }
  });
  return cuenta;
}

/** El punto junto al logotipo; se busca por CSS porque en celular el dock de escritorio está oculto. */
const punto = (page: Page) => page.locator('a[aria-label="Westvane, resumen"] [role="status"]');

/** El texto de estado de la hoja «Más» (sigue montado, aunque la hoja quede oculta al pasar a escritorio). */
const textoDeLaHoja = (page: Page) =>
  page.locator('[role="dialog"][aria-label="Más secciones"] [role="status"]').filter({ hasText: ESTADO });

/** El dock ya hidrató y tiene su primera lectura: dejó de decir «Verificando…». */
async function esperarPrimeraLectura(page: Page) {
  await expect(punto(page)).toHaveText(ESTADO);
}

async function abrirMasEnCelular(page: Page) {
  const nav = page.getByRole("navigation", { name: "Navegación principal (celular)" });
  await nav.getByRole("button", { name: /Más/ }).click();
  const hoja = page.getByRole("dialog", { name: "Más secciones" });
  await expect(hoja).toBeVisible();
  return hoja;
}

test.describe("en celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("abrir «Más» reutiliza el sondeo del punto y no lanza otro", async ({ page }) => {
    const cuenta = await contarSondeos(page);
    await page.goto("/panel");
    await esperarPrimeraLectura(page);
    // Deja terminar la comprobación de arranque del aviso de conexión, que también pregunta una vez.
    await expect.poll(() => cuenta.enVuelo, { timeout: 5_000 }).toBe(0);
    await page.waitForTimeout(400);
    await expect(textoDeLaHoja(page)).toHaveCount(0);
    const antes = cuenta.total;
    cuenta.maxEnVuelo = 0;

    const hoja = await abrirMasEnCelular(page);
    const texto = hoja.getByRole("status").filter({ hasText: ESTADO });
    await expect(texto).toBeVisible();
    await page.waitForTimeout(1_000);

    expect(cuenta.total - antes, "montar el texto de la hoja no debe abrir otro sondeo").toBe(0);
    expect(cuenta.maxEnVuelo, "nunca hay dos peticiones de salud a la vez").toBeLessThanOrEqual(1);
    // Los dos textos salen del mismo almacén
    await expect(texto).toHaveText("Sistema en línea");
    await expect(punto(page)).toHaveText("Sistema en línea");
  });
});

test.describe("en escritorio", () => {
  test("el punto y el texto de «Más» comparten un solo intervalo de 30 s", async ({ page }) => {
    // Espera un intervalo real de 30 s: el margen del proyecto (60 s) queda justo en una máquina lenta.
    test.setTimeout(90_000);
    // La hoja solo se abre desde el dock del celular: se abre ahí y se vuelve al escritorio, como al girar un
    // teléfono. Así el punto y el texto quedan montados a la vez, que es el caso que antes creaba dos intervalos.
    await page.setViewportSize({ width: 390, height: 844 });
    const cuenta = await contarSondeos(page);
    await page.goto("/panel");
    await esperarPrimeraLectura(page);

    const hoja = await abrirMasEnCelular(page);
    await expect(hoja.getByRole("status").filter({ hasText: ESTADO })).toBeVisible();

    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(punto(page)).toBeVisible();
    await expect(textoDeLaHoja(page)).toHaveText(ESTADO);
    await page.waitForTimeout(600);

    // Un intervalo completo: los dos widgets deben apoyarse en la misma sonda; dos intervalos darían dos peticiones.
    const antes = cuenta.total;
    await page.waitForTimeout(32_000);
    await page.waitForTimeout(1_000);
    expect(cuenta.total - antes, "un solo sondeo compartido en 30 s").toBe(1);
  });
});
