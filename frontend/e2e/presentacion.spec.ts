import { expect, test, watchErrors } from "./helpers";

test("presentación: sin dock ni bienvenida, con el mapa real y las dos acciones", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /red real de Colombia/ })).toBeVisible();
  // Es pública: ni el dock de la app ni el diálogo de bienvenida
  await expect(page.getByRole("navigation", { name: "Navegación principal", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Antes de empezar" })).toHaveCount(0);
  await expect(page.locator('#red svg[aria-label^="Red multimodal"]')).toBeVisible();

  // La franja de modos resalta un modo en el mapa
  const strip = page.getByRole("group", { name: "Resaltar un modo en el mapa" });
  await strip.getByRole("button", { name: /Fluvial/ }).click();
  await expect(strip.getByRole("button", { name: /Fluvial/ })).toHaveAttribute("aria-pressed", "true");

  // «Ver la app en vivo» lleva al resumen de la app
  await page.getByRole("link", { name: "Ver la app en vivo" }).first().click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("navigation", { name: "Navegación principal", exact: true })).toBeVisible();
  w.expectClean();
});

test("presentación: la ruta en vivo recalcula con el motor real", async ({ page }) => {
  await page.goto("/#ruta");
  const section = page.locator("#ruta");
  await expect(section.getByText("Bogotá → Leticia", { exact: true })).toBeVisible();
  await section.getByLabel("Destino").selectOption("Cartagena");
  await section.getByRole("button", { name: "Calcular" }).click();
  await expect(section.getByText("Bogotá → Cartagena", { exact: true })).toBeVisible();
  await expect(section.getByRole("link", { name: /Abrir como cotización/ })).toHaveAttribute("href", /destino=Cartagena/);
});

test("presentación: pedir una demostración exige la autorización y confirma", async ({ page }) => {
  await page.goto("/#demostracion");
  const form = page.locator("#demostracion form");
  const stamp = Date.now();
  await form.getByLabel(/^Nombre/).fill("Persona de Prueba");
  await form.getByLabel(/^Empresa/).fill(`Operador ${stamp}`);
  await form.getByLabel(/^Correo de trabajo/).fill(`prueba${stamp}@westvane.invalid`);
  const send = form.getByRole("button", { name: "Pedir demostración" });
  await expect(send).toBeDisabled();
  await form.getByRole("checkbox").check();
  await send.click();
  await expect(page.getByText("Recibimos su solicitud.")).toBeVisible();
  await expect(page.getByText(`Operador ${stamp}`)).toBeVisible();
});
