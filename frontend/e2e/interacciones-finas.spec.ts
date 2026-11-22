import { expect, test } from "./helpers";

/**
 * Movimiento fino de las tarjetas-enlace: con puntero fino la fila sube 2 px al pasar el cursor y se hunde al
 * presionar (utilidad `lift` de globals.css). Con «reducir movimiento» no se mueve: solo cambian borde y fondo.
 */
test("los avisos del panel suben 2 px y se hunden al presionar", async ({ page }) => {
  await page.goto("/panel");
  const aviso = page.locator('section[aria-labelledby="atencion"] a.lift').first();
  await expect(aviso).toBeVisible();

  await aviso.hover();
  await expect(aviso).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -2)");

  // Presión: la transición de 120 ms termina en el hundimiento (toHaveCSS reintenta hasta verlo).
  await page.mouse.down();
  await expect(aviso).toHaveCSS("transform", "matrix(0.98, 0, 0, 0.98, 0, -2)");

  // Soltar aquí completaría un clic y el enlace navegaría: se cancela ese clic (en captura y una sola vez) para
  // quedarse en el panel. El puntero no se mueve: sigue sobre el aviso, así la vuelta es al estado con hover.
  await page.evaluate(() => document.addEventListener("click", (e) => e.preventDefault(), { capture: true, once: true }));
  await page.mouse.up();
  await expect(aviso).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -2)");
});

test("las filas de la flota y las bodegas llevan lift y suben al pasar el puntero", async ({ page }) => {
  await page.goto("/flota");
  const fila = page.locator("ul.rule-list a.lift").first();
  await expect(fila).toBeVisible();
  await fila.hover();
  await expect(fila).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -2)");

  await page.goto("/bodegas");
  await expect(page.locator("a.lift").first()).toBeVisible();
});

test.describe("con reducir movimiento", () => {
  test.use({ reducedMotion: "reduce" });

  test("el aviso del panel no se mueve al pasar el puntero", async ({ page }) => {
    await page.goto("/panel");
    const aviso = page.locator('section[aria-labelledby="atencion"] a.lift').first();
    await expect(aviso).toBeVisible();
    await aviso.hover();
    await expect(aviso).toHaveCSS("transform", "none");
  });
});
