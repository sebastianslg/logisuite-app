import { expect, test, watchErrors } from "./helpers";

test("bitácora: nota e incidencia con retraso en la ficha del envío", async ({ page, request }) => {
  const w = watchErrors(page);
  const list = await (await request.get("/api/shipments?status=En%20Ruta")).json();
  test.skip(!list.items.length, "no hay envíos en ruta");
  const code = list.items[0].code as string;
  await page.goto(`/envios/${code}`);
  const timeline = page.getByRole("list", { name: "Línea de tiempo del envío" });
  await expect(timeline).toBeVisible();

  // Textos únicos: la base de las pruebas se conserva entre corridas
  const stamp = Date.now();
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await page.locator("textarea").fill(`Nota de prueba ${stamp}`);
  await page.getByRole("button", { name: "Guardar nota" }).click();
  await expect(timeline.getByText(`Nota de prueba ${stamp}`)).toBeVisible();

  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await page.locator("select").first().selectOption("paro");
  await page.getByPlaceholder("0").fill("2");
  await page.locator("textarea").fill(`Paro camionero ${stamp}`);
  await page.getByRole("button", { name: "Registrar incidencia" }).click();
  await expect(timeline.getByText(`Paro camionero ${stamp}`)).toBeVisible();
  await expect(timeline.getByRole("button", { name: /Marcar resuelta/ }).first()).toBeVisible();
  w.expectClean();
});

test("importar envíos: vista previa sin guardar", async ({ page }) => {
  await page.goto("/envios");
  await page.getByRole("button", { name: "Importar" }).click();
  const dep = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16).replace("T", " ");
  await page.locator('input[aria-label="Archivo de envíos"]').setInputFiles({
    name: "envios.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`origen,destino,carga,cliente,peso_t,salida\nBogotá,Cartagena,Café,Prueba,20,${dep}\nAtlántida,Cali,X,Y,5,${dep}\n`),
  });
  await expect(page.getByText(/1 de 2 filas se pueden crear/)).toBeVisible();
  await expect(page.getByText(/Atlántida/)).toBeVisible();
  // Guardar exige declarar la autorización sobre los datos personales del archivo
  const create = page.getByRole("button", { name: "Crear 1 envío" });
  await expect(create).toBeDisabled();
  await page.getByRole("checkbox", { name: /Declaro que tengo autorización/ }).check();
  await expect(create).toBeEnabled();
});

test("modo presentación y metodología", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Presentar" }).click();
  const dialog = page.getByRole("dialog", { name: "Modo presentación" });
  await expect(dialog.getByText("Envíos en ruta")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.goto("/metodologia");
  await expect(page.getByRole("img", { name: "Grafo expandido por estados" })).toBeVisible();
  w.expectClean();
});

test("prueba de entrega: firmar en pantalla, ver el comprobante y anular", async ({ page, request }) => {
  const w = watchErrors(page);
  const list = await (await request.get("/api/shipments?status=Entregado")).json();
  let code = "";
  for (const s of list.items as { code: string }[]) {
    const d = await (await request.get(`/api/shipments/${s.code}/delivery`)).json();
    if (d.can_record) {
      code = s.code;
      break;
    }
  }
  test.skip(!code, "no hay envíos entregados sin entrega registrada");
  await page.goto(`/envios/${code}`);
  await page.getByRole("button", { name: "Registrar entrega" }).click();
  await page.getByLabel("Recibe (nombre completo)").fill("Prueba Automática");

  // Guardar sin firma avisa
  await page.getByRole("button", { name: /Guardar entrega/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Falta la firma" })).toBeVisible();

  const pad = page.getByRole("img", { name: /Firma de quien recibe/ });
  // El formulario entra con un desplazamiento corto: se firma cuando el lienzo ya está quieto (si el trazo cae
  // durante la entrada, se repite)
  await expect(async () => {
    const a = (await pad.boundingBox())!;
    await page.waitForTimeout(120);
    const box = (await pad.boundingBox())!;
    expect(Math.abs(box.y - a.y)).toBeLessThan(0.5);
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
    await page.mouse.up();
    await expect(pad).toHaveAccessibleName(/firmada/, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });

  await page.getByRole("button", { name: /Guardar entrega/ }).click();
  await expect(page.getByText("Recibió Prueba Automática", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Firma de Prueba Automática" })).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Anular" }).click();
  await expect(page.getByRole("button", { name: "Registrar entrega" })).toBeVisible();
  w.expectClean();
});

test("flota: SOAT y técnico-mecánica en la ficha del vehículo y en el formulario", async ({ page, request }) => {
  const w = watchErrors(page);
  const list = await (await request.get("/api/fleet/vehicles?mode=terrestre")).json();
  const v = list.items[0];
  await page.goto(`/flota/${v.id}`);
  await expect(page.getByRole("heading", { name: "Documentos obligatorios" })).toBeVisible();
  await expect(page.getByText("SOAT", { exact: true })).toBeVisible();
  await page.goto(`/flota/${v.id}/editar`);
  await expect(page.getByLabel("SOAT vigente hasta")).toHaveValue(v.soat_expiry);
  w.expectClean();
});

test("flota: la orden de trabajo de un mantenimiento se abre como PDF", async ({ page, request }) => {
  const w = watchErrors(page);
  const list = await (await request.get("/api/fleet/maintenance")).json();
  test.skip(!list.items.length, "no hay mantenimientos");
  const m = list.items.find((x: { status: string }) => x.status !== "Cancelado") ?? list.items[0];
  await page.goto(`/flota/${m.vehicle_id}`);
  const link = page.getByRole("link", { name: "Orden de trabajo (PDF)" }).first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  w.expectClean();
});
