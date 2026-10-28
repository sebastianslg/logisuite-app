import { expect, test, watchErrors } from "./helpers";

test("crear, editar y borrar un envío", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/envios/nuevo");
  await page.getByPlaceholder("Ej. Café excelso en sacos").fill("Prueba automática");
  await page.getByLabel(/Cliente/).first().fill("Cliente de prueba");
  await page.getByRole("button", { name: /Crear envío/ }).click();
  await page.waitForURL(/\/envios\/LS-[\d-]+$/);
  const code = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible();

  await page.goto(`/envios/${code}/editar`);
  await page.getByRole("button", { name: /Guardar cambios/ }).click();
  await page.waitForURL(new RegExp(`/envios/${code}$`));

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Borrar" }).click();
  await page.waitForURL(/\/envios$/);
  expect((await page.goto(`/envios/${code}`))?.status()).toBe(404);
  w.expectClean();
});

test("filtros de la tabla y exportación a Excel", async ({ page }) => {
  await page.goto("/envios");
  const enRuta = page.getByRole("button", { name: /^En Ruta/ }).first();
  await enRuta.click();
  await expect(enRuta).toHaveAttribute("aria-pressed", "true");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Excel/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByPlaceholder("Buscar envío, ciudad, carga, cliente").fill("zzzz-no-existe");
  await expect(page.getByText("Ningún envío coincide").first()).toBeVisible();
});

test("historial: vistas y ventana de tiempo", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/historial");
  for (const v of ["Departamentos", "Corredores", "Ciudades"]) {
    await page.getByRole("radio", { name: v }).click();
    await expect(page.getByRole("radio", { name: v })).toHaveAttribute("aria-checked", "true");
  }
  await page.getByRole("link", { name: "7 días" }).click();
  await expect(page).toHaveURL(/dias=7/);
  w.expectClean();
});
