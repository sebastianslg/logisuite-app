import { expect, test, watchErrors } from "./helpers";

test("flota: cargar vehículos desde un archivo muestra la vista previa y no guarda", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/flota");
  await expect(page.getByRole("button", { name: "Excel" })).toBeVisible();
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.locator('input[aria-label="Archivo de vehículos"]').setInputFiles({
    name: "vehiculos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("placa,modo,tipo\nPRB111,Terrestre,Tractomula 3S3\nPRB222,Nave,Barco\n"),
  });
  await expect(page.getByText(/1 de 2 filas se pueden crear/)).toBeVisible();
  await expect(page.getByText(/Modo no válido/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Crear 1 vehículos/ })).toBeEnabled();
  w.expectClean();
});

test("bodegas: la exportación del inventario descarga un Excel", async ({ page }) => {
  await page.goto("/bodegas");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Excel" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^inventario.*\.xlsx$/);
});

test("sin conexión aparece el aviso y se va al volver la red", async ({ page, context }) => {
  await page.goto("/");
  // Con la página hidratada: si se corta la red antes, el aviso no alcanza a escuchar el evento
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // El texto completo, no el rol: el punto del dock también es role=status y dice «Sin conexión»
  // cuando la API falla, y con dos coincidencias el localizador de rol se volvía ambiguo.
  const banner = page.getByText("Sin conexión: los cambios no se guardarán hasta que vuelva");
  await expect(banner).toHaveCount(0);
  await context.setOffline(true);
  // Como un despertar de pestaña: cubre el caso en que el evento "offline" del navegador no llegó
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(banner).toBeVisible();
  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
});
