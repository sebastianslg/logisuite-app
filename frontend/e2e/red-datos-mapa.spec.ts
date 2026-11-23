import { expect, test } from "./helpers";

/**
 * Regresión: al pasar a «Datos», ocultar el simulador y volver a «Mapa», el mapa no puede quedar en blanco.
 * La causa era `display:none`: el lienzo perdía el tamaño y las capas base (silueta y máscara) no se reconstruían.
 * Ahora el contenedor usa `visibility` (conserva tamaño) y el reloj se pausa mientras no se ve.
 */
test("Red: Datos, cerrar el simulador y volver a Mapa conserva la cartografía", async ({ page }) => {
  await page.goto("/red");
  const mapa = page.locator('[data-testid="mapa-colombia"]').filter({ visible: true }).first();
  await expect(mapa).toHaveAttribute("data-map-ready", "1", { timeout: 30_000 });
  await expect(mapa).toHaveAttribute("data-map-stage", "8", { timeout: 30_000 });

  const lienzo = mapa.locator("canvas").first();
  const antes = await lienzo.boundingBox();
  expect(antes?.width ?? 0).toBeGreaterThan(200);
  expect(antes?.height ?? 0).toBeGreaterThan(200);

  await page.getByRole("button", { name: "Datos", exact: true }).click();
  await page.getByRole("button", { name: "Ocultar simulador" }).click();
  // Un rato en Datos: antes bastaba para que el mapa se quedara sin las capas base.
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();

  await expect(mapa).toBeVisible();
  await expect(mapa).toHaveAttribute("data-map-stage", "8");
  const despues = await lienzo.boundingBox();
  expect(despues?.width ?? 0).toBeGreaterThan(200);
  expect(despues?.height ?? 0).toBeGreaterThan(200);
  // La silueta y la máscara se dibujan con el mapa base apagado; el atributo lo deja explícito.
  await expect(mapa).toHaveAttribute("data-map-land", "local");
  // El lienzo sigue devolviendo un contexto vivo (no se perdió al ocultarlo).
  expect(await lienzo.evaluate((c: HTMLCanvasElement) => Boolean(c.getContext("webgl2") && !c.getContext("webgl2")!.isContextLost()))).toBe(true);
});
