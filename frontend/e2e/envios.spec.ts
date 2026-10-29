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
  for (const v of ["Departamentos", "Corredores", "Retrasos", "Ciudades"]) {
    await page.getByRole("radio", { name: v }).click();
    await expect(page.getByRole("radio", { name: v })).toHaveAttribute("aria-checked", "true");
    if (v === "Retrasos") {
      await expect(page.getByRole("heading", { name: "Retrasos por vía y día de salida" }).or(page.getByText("Sin retrasos en esta ventana"))).toBeVisible();
    }
  }
  await page.getByRole("link", { name: "7 días" }).click();
  await expect(page).toHaveURL(/dias=7/);
  w.expectClean();
});

test("elegir a mano el vehículo de un tramo y volver a automático", async ({ page, request }) => {
  const w = watchErrors(page);
  const created = await request.post("/api/shipments", {
    data: {
      origin: "Bogotá", destination: "Tunja", cargo: "Prueba de vehículo", weight_t: 3, client: "QA", priority: "costo",
      forced_modes: ["terrestre"], usuario: "Prueba",
      departure_at: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 16),
    },
  });
  expect(created.status()).toBe(201);
  const code = (await created.json()).code as string;
  try {
    await page.goto(`/envios/${code}`);
    await page.getByRole("button", { name: "Cambiar vehículo" }).first().click();
    const sheet = page.getByRole("dialog", { name: /Vehículo del tramo 1/ });
    await expect(sheet).toBeVisible();
    // Otro vehículo libre, además del actual
    await sheet.locator("input[name=vehiculo]:not(:checked):not(:disabled)").first().check();
    await sheet.getByRole("button", { name: "Asignar" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Fijado a mano")).toBeVisible();

    await page.getByRole("button", { name: "Cambiar vehículo" }).first().click();
    await page.getByRole("button", { name: "Volver a automático" }).click();
    await expect(page.getByText("Fijado a mano")).toBeHidden();
  } finally {
    await request.delete(`/api/shipments/${code}?usuario=Prueba`);
  }
  w.expectClean();
});

test("lista de envíos: filtro «Por firmar» desde la URL y desde el chip", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/envios?firmar=1");
  const chip = page.getByRole("button", { name: /Por firmar/ });
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  const rows = page.locator("table tbody tr");
  if (await rows.count()) await expect(rows.first().getByText("Sin firmar")).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  w.expectClean();
});

test("lista de envíos: columna de vehículo presente en la tabla", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/envios");
  await expect(page.getByRole("columnheader", { name: "Vehículo" })).toBeAttached();
  w.expectClean();
});
