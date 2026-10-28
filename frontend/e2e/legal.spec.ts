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

// Seguimiento público: un cliente abre el enlace sin haber aceptado nada y sin ver el menú ni datos internos
test("el enlace de seguimiento se abre sin menú ni bienvenida y no muestra datos internos", async ({ page, request }) => {
  const w = watchErrors(page);
  const dep = new Date(Date.now() - 2 * 3_600_000).toISOString().slice(0, 16);
  const created = await request.post("/api/shipments", {
    data: { origin: "Bogotá", destination: "Medellín", cargo: "Repuestos", weight_t: 12, priority: "costo", client: "Cliente Reservado S.A.", departure_at: dep },
  });
  const { code } = await created.json();
  const { token } = await (await request.post(`/api/shipments/${code}/tracking`)).json();

  await page.goto(`/seguimiento/${token}`);
  await expect(page.getByRole("heading", { name: code, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recorrido" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
  await expect(page.getByText("Cliente Reservado")).toHaveCount(0);

  await request.delete(`/api/shipments/${code}/tracking/${token}`);
  await page.goto(`/seguimiento/${token}`);
  await expect(page.getByText(/no encontrad|no existe|404/i).first()).toBeVisible();
  w.expectClean();
});
