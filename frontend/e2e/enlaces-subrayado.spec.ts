import { expect, test } from "./helpers";

/**
 * Los enlaces de texto llevan la utilidad `link-draw` (globals.css): el subrayado es un pseudo-elemento de 1 px del
 * color del texto que en reposo mide 0 de ancho y, al pasar el puntero, se dibuja de izquierda a derecha en 200 ms.
 * Va en la etiqueta y no en la caja del control (que tiene alto, relleno y fondo), para que quede bajo el texto.
 * Con «reducir movimiento» queda fijo: sin dibujo y sin transición.
 */
test("la etiqueta «Abrir mapa» del panel se subraya de izquierda a derecha al pasar el puntero", async ({ page }) => {
  await page.goto("/panel");
  const etiqueta = page.getByRole("link", { name: /Abrir mapa/ }).locator("span.link-draw");
  await expect(etiqueta).toHaveText("Abrir mapa");

  const subrayado = () => etiqueta.evaluate((el) => getComputedStyle(el, "::after").transform);
  expect(await subrayado(), "sin puntero el subrayado mide 0").toBe("matrix(0, 0, 0, 1, 0, 0)");

  await etiqueta.hover();
  // La transición dura 200 ms: se espera a que llegue al ancho completo.
  await expect.poll(subrayado).toBe("matrix(1, 0, 0, 1, 0, 0)");
});

test("la ficha del envío lleva el subrayado bajo la etiqueta del enlace de vuelta", async ({ page }) => {
  const lista = await page.request.get("/api/shipments?limit=1");
  expect(lista.ok(), await lista.text()).toBe(true);
  const { items } = (await lista.json()) as { items: { code: string }[] };
  expect(items.length, "hace falta al menos un envío en la base de pruebas").toBeGreaterThan(0);

  await page.goto(`/envios/${encodeURIComponent(items[0].code)}`);
  const volver = page.locator('a[href="/envios"] span.link-draw');
  await expect(volver).toBeVisible();
  await expect(volver).toHaveText("Envíos");
});

test.describe("con reducir movimiento", () => {
  test.use({ reducedMotion: "reduce" });

  test("el subrayado de la etiqueta queda fijo, sin dibujo", async ({ page }) => {
    await page.goto("/panel");
    const etiqueta = page.getByRole("link", { name: /Abrir mapa/ }).locator("span.link-draw");
    await expect(etiqueta).toHaveText("Abrir mapa");
    expect(await etiqueta.evaluate((el) => getComputedStyle(el, "::after").transform)).toBe("none");
  });
});
