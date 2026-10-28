import { expect, test } from "@playwright/test";

import { watchErrors } from "./helpers";

// Navegador nuevo, sin aceptaciones: aquí se prueba la bienvenida en sí
test("la primera visita pide aceptar términos y datos en dos casillas separadas, y queda registrado", async ({ page }) => {
  const w = watchErrors(page);
  // Los documentos se leen sin haber aceptado
  await page.goto("/privacidad");
  await expect(page.getByRole("heading", { name: "Política de tratamiento de datos", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Antes de empezar" });
  await expect(dialog).toBeVisible();
  const go = dialog.getByRole("button", { name: "Aceptar y continuar" });
  await expect(go).toBeDisabled();
  await dialog.getByRole("checkbox").nth(0).check();
  await expect(go).toBeDisabled(); // una sola casilla no basta
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog.getByRole("textbox").fill("Prueba de aceptación");
  await go.click();
  await expect(dialog).toHaveCount(0);

  // No se vuelve a pedir y Configuración muestra lo aceptado
  await page.reload();
  await page.goto("/configuracion");
  await expect(page.getByRole("dialog", { name: "Antes de empezar" })).toHaveCount(0);
  await expect(page.getByText("Términos y condiciones").first()).toBeVisible();
  await expect(page.getByText(/Aceptado · versión/).first()).toBeVisible();
  w.expectClean();
});
