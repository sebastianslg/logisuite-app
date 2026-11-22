import type { Page } from "@playwright/test";

import { expect, test, watchErrors } from "./helpers";

/**
 * Carga diferida: la paleta y la ayuda de atajos se piden al abrirse (o al mostrar intención) y no viajan con la
 * primera pantalla; el campo de la paleta recibe la primera tecla sin esperar a la lista. El mapa 3D de la ficha solo
 * se monta al elegirlo. Y la lista de envíos nunca pinta todas las filas de la base en el DOM.
 */

/** La app ya hidrató: el dock consultó el estado y dejó de decir «Verificando…». */
async function hydrated(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /Sistema en línea|Sin conexión/ }).first()).toBeVisible();
}

test("la paleta se pide al abrirse, guarda la primera tecla y vuelve limpia al reabrir", async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto("/panel");
  await hydrated(page);

  const dialog = page.getByRole("dialog", { name: "Buscar o ejecutar un comando" });
  // El cuerpo de la paleta no está en el documento hasta que se pide: no pesa en la primera pantalla
  await expect(page.locator("#palette-list")).toHaveCount(0);

  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox");
  await expect(input).toBeFocused();

  // Lo escrito entra en el campo del armazón aunque la lista todavía esté llegando
  await page.keyboard.type("env");
  await expect(input).toHaveValue("env");
  // «Envíos» como comando (el texto de la fila empieza por su nombre); un resultado de envío empieza por su código
  const envios = dialog.getByRole("option").filter({ hasText: /^Envíos/ }).first();
  await expect(envios).toBeVisible();
  // Los atajos reales acompañan a la acción, como en los menús del dock
  await expect(envios.locator("kbd").filter({ hasText: "g" })).toBeVisible();
  await expect(envios.locator("kbd").filter({ hasText: "e" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Reabrir no arrastra la búsqueda anterior y el foco vuelve al campo
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");

  watch.expectClean();
});

test("la ayuda de atajos se abre al pedirla, se repite y el menú Más muestra cada atajo", async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto("/panel");
  await hydrated(page);

  const dialog = page.getByRole("dialog", { name: "Atajos de teclado" });
  await expect(dialog).toHaveCount(0);

  await page.keyboard.press("Shift+Slash");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2, name: "Atajos de teclado" })).toBeVisible();
  await expect(dialog.getByText("Ver estos atajos", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Segunda apertura: el trozo ya está en memoria y la hoja se vuelve a montar
  await page.keyboard.press("Shift+Slash");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // En el menú del dock, cada destino enseña la secuencia que lo abre («g» y luego su letra)
  const nav = page.getByRole("navigation", { name: "Navegación principal", exact: true });
  await nav.getByRole("button", { name: "Más", exact: true }).click();
  const vias = page.getByRole("link", { name: "Vías y cierres" });
  await expect(vias).toBeVisible();
  await expect(vias.locator("kbd").filter({ hasText: "g" })).toBeVisible();
  await expect(vias.locator("kbd").filter({ hasText: "v" })).toBeVisible();

  watch.expectClean();
});

test("la ficha del envío empieza plana y el mapa 3D solo se monta al elegirlo", async ({ page, request }) => {
  const watch = watchErrors(page);
  const { items } = await (await request.get("/api/shipments?limit=1")).json();
  expect(items.length, "hace falta al menos un envío en la base de pruebas").toBeGreaterThan(0);
  const code: string = items[0].code;

  await page.goto(`/envios/${encodeURIComponent(code)}`);
  await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible();

  // Entrada: la red plana ocupa el recuadro; no hay lienzo WebGL ni tarea de compilación
  await expect(page.locator('svg[aria-label^="Red multimodal"]').first()).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  const ver3D = page.getByRole("button", { name: "Ver el recorrido en 3D" });
  await expect(ver3D).toBeVisible();

  // La elección explícita sí monta el mapa real
  await ver3D.click();
  // Sin mapa base (apagado por defecto, sección 77) deck.gl dibuja solo Colombia: no hay lienzo de MapLibre
  await page.locator('[data-testid="mapa-colombia"]').first().waitFor({ state: "attached", timeout: 30_000 });
  await expect(ver3D).toHaveCount(0);

  watch.expectClean();
});

test("la lista de envíos pagina el DOM y la importación se abre bajo demanda", async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto("/envios");
  await expect(page.getByRole("heading", { level: 1, name: "Envíos multimodales" })).toBeVisible();

  // La página trae 25 envíos por tanda: el DOM nunca ve las 1000 filas de una exportación
  const filas = await page.locator("table tbody tr").count();
  expect(filas).toBeLessThanOrEqual(50);

  // La vista de importación se pide al abrir la hoja y sigue funcionando igual
  await page.getByRole("button", { name: "Importar" }).click();
  const hoja = page.getByRole("dialog", { name: "Importar envíos" });
  await expect(hoja).toBeVisible();
  await expect(page.locator('input[aria-label="Archivo de envíos"]')).toBeAttached();

  watch.expectClean();
});
