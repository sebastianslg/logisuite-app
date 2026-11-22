import { expect, test, watchErrors } from "./helpers";

/**
 * Borrador del envío nuevo: se escribe en este navegador medio segundo después de la última tecla, se ofrece al
 * volver a /envios/nuevo y se borra al descartarlo (o al guardar el envío). Nunca viaja al servidor.
 */
const KEY = "westvane.borrador-envio";

test("borrador del envío nuevo: se recupera al recargar y se descarta con «Empezar de nuevo»", async ({ page }) => {
  const w = watchErrors(page);
  const guardado = () => page.evaluate((k) => localStorage.getItem(k), KEY);
  const aviso = page.getByText(/Quedó un envío a medias/);

  await page.goto("/envios/nuevo");
  // La lista de ciudades llega al hidratar: el formulario ya escucha las teclas antes de escribir.
  await expect.poll(() => page.locator("form select").first().locator("option").count()).toBeGreaterThan(3);
  const carga = page.getByPlaceholder("Ej. Café excelso en sacos");
  const cliente = page.getByLabel(/Cliente/).first();
  await carga.fill("Borrador de prueba");
  await cliente.fill("Cliente del borrador");
  // El borrador se escribe con retraso (o al cerrar la pestaña): se espera a que exista, sin dormir a ciegas.
  await expect.poll(guardado).not.toBeNull();

  await page.reload();
  await expect(aviso).toBeVisible();
  await page.getByRole("button", { name: "Retomar" }).click();
  await expect(aviso).toHaveCount(0);
  await expect(carga).toHaveValue("Borrador de prueba");
  await expect(cliente).toHaveValue("Cliente del borrador");

  // Al volver a entrar el borrador sigue ahí; «Empezar de nuevo» lo borra de este navegador
  await page.reload();
  await expect(aviso).toBeVisible();
  await page.getByRole("button", { name: "Empezar de nuevo" }).click();
  await expect(aviso).toHaveCount(0);
  await expect(carga).toHaveValue("");
  await expect(cliente).toHaveValue("");
  await expect.poll(guardado).toBeNull();

  // Ya descartado no vuelve. La lista de ciudades llega al hidratar: el formulario está vivo y el aviso no aparece.
  await page.reload();
  await expect.poll(() => page.locator("form select").first().locator("option").count()).toBeGreaterThan(3);
  await expect(aviso).toHaveCount(0);
  w.expectClean();
});

/**
 * El borrador es solo del envío nuevo: editar un envío existente no lo lee, no lo escribe y no lo ofrece.
 * Si se rompe esa guarda (quitar el `shipment ||` del efecto), esta prueba lo canta sin tocar el servidor.
 */
test("editar un envío existente no toca el borrador del envío nuevo", async ({ page }) => {
  const w = watchErrors(page);
  const lista = ((await page.request.get("/api/shipments?limit=1")).json() as Promise<{ items: { code: string }[] }>);
  const { code } = (await lista).items[0];
  // Solo los valores: la hora del guardado puede moverse una vez más mientras se sigue en el envío nuevo
  const guardado = () => page.evaluate((k) => JSON.stringify(JSON.parse(localStorage.getItem(k) ?? "null")?.values ?? null), KEY);

  // Un borrador a medio hacer
  await page.goto("/envios/nuevo");
  await expect.poll(() => page.locator("form select").first().locator("option").count()).toBeGreaterThan(3);
  await page.getByPlaceholder("Ej. Café excelso en sacos").fill("Borrador que debe sobrevivir");
  await expect.poll(guardado).not.toBe("null");
  const antes = await guardado();

  // Editar un envío y teclear: el borrador del envío nuevo no puede cambiar
  await page.goto(`/envios/${code}/editar`);
  const carga = page.getByPlaceholder("Ej. Café excelso en sacos");
  await expect(carga).not.toHaveValue("");
  await carga.fill("Un cambio en la edición");
  await page.waitForTimeout(1200);   // el borrador se escribiría con retraso si la guarda estuviera rota
  expect(await guardado()).toBe(antes);

  // Y en la edición jamás se ofrece el borrador
  await expect(page.getByText(/Quedó un envío a medias/)).toHaveCount(0);
  w.expectClean();
});
