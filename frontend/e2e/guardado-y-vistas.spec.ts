import { expect, test } from "./helpers";

test("dos envíos del formulario de bodega mientras guarda producen una sola petición", async ({ page }) => {
  let peticiones = 0;
  let liberar!: () => void;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  await page.route("**/api/warehouses", async route => {
    if (route.request().method() !== "POST") return route.continue();
    peticiones++;
    await espera;
    await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ detail: "Revisa el nombre." }) });
  });
  await page.goto("/bodegas/nueva");
  await page.getByLabel("Nombre", { exact: true }).fill("Prueba de guardado");
  await page.locator("form").evaluate(f => { if (f instanceof HTMLFormElement) { f.requestSubmit(); f.requestSubmit(); } });
  try {
    await expect(page.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    await expect.poll(() => peticiones).toBe(1);
  } finally { liberar(); }
  await expect(page.getByText("Revisa el nombre.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear bodega" })).toBeEnabled();
  expect(peticiones).toBe(1);
});
