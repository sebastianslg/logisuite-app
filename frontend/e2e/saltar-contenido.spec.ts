import { expect, test } from "./helpers";

/**
 * «Saltar al contenido»: es el primer elemento enfocable de la página, queda oculto hasta que el teclado lo enfoca y,
 * al pulsar Enter, deja el foco (y el desplazamiento) en el <main id="contenido">. Así quien navega con teclado o con
 * lector de pantalla no tiene que recorrer el dock en cada página de la app.
 */
test("el enlace «Saltar al contenido» aparece con el primer Tab y lleva al main", async ({ page }) => {
  await page.goto("/envios");

  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toHaveCount(1);

  // En reposo está fuera de la vista: no ocupa espacio ni tapa el contenido.
  const hidden = await skip.boundingBox();
  if (hidden) expect(hidden.y + hidden.height, "el enlace no debe verse en reposo").toBeLessThanOrEqual(0);

  // Con la página desplazada, el primer Tab debe encontrar el enlace y mostrarlo.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();

  const box = await skip.boundingBox();
  expect(box, "el enlace debe verse al recibir el foco").not.toBeNull();
  if (!box) throw new Error("Sin caja del enlace «Saltar al contenido»");
  expect(box.height, "objetivo táctil de al menos 44 px").toBeGreaterThanOrEqual(44);
  expect(box.y, "el enlace debe quedar dentro de la pantalla").toBeGreaterThanOrEqual(0);
  const viewport = page.viewportSize();
  if (viewport) expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  // Enter: la URL lleva el ancla y el foco queda en el main, que vuelve a quedar a la vista.
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const main = document.querySelector<HTMLElement>("main#contenido");
        return {
          focoEnMain: !!el && el.id === "contenido" && el.tagName === "MAIN",
          mainALaVista: !!main && main.getBoundingClientRect().top >= 0,
          arriba: window.scrollY <= 1,
        };
      }),
    )
    .toEqual({ focoEnMain: true, mainALaVista: true, arriba: true });
});
