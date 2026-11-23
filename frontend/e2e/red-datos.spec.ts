import { expect, test, watchErrors } from "./helpers";

/**
 * Red: en «Datos» el panel del simulador es lo único en pantalla. Cerrarlo dejaba la página en blanco y había que
 * volver al menú; ahora la X de Datos vuelve al mapa, y si el simulador estaba oculto, Datos lo muestra igual.
 */
test("Red: cerrar los datos vuelve al mapa y nunca queda la página en blanco", async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto("/red");
  await expect(page.getByRole("heading", { name: "Ahora en la red" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Datos", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar los datos y volver al mapa" }).click();
  await expect(page.getByRole("button", { name: "Mapa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Ahora en la red" })).toBeVisible();

  // Simulador oculto sobre el mapa y luego «Datos»: el panel aparece igual
  await page.getByRole("button", { name: "Ocultar simulador" }).click();
  await expect(page.getByRole("button", { name: "Mostrar simulador" })).toBeVisible();
  await page.getByRole("button", { name: "Datos", exact: true }).click();
  await expect(page.getByRole("button", { name: "Simular ruta" })).toBeVisible();

  watch.expectClean();
});
