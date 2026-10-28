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
  await page.getByRole("button", { name: "Registrar" }).click();
  await page.locator("textarea").fill(`Nota de prueba ${stamp}`);
  await page.getByRole("button", { name: "Guardar nota" }).click();
  await expect(timeline.getByText(`Nota de prueba ${stamp}`)).toBeVisible();

  await page.getByRole("button", { name: "Registrar" }).click();
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
