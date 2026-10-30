import { expect, PAGES, test, watchErrors } from "./helpers";

test("todas las páginas cargan sin errores", async ({ page }) => {
  const w = watchErrors(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
  }
  w.expectClean();
});

test("el dock navega, el menú Más se cierra con Escape y Ctrl K abre la búsqueda", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal", exact: true });
  for (const [label, url] of [["Envíos", /\/envios$/], ["Flota", /\/flota$/], ["Resumen", /\/$/]] as const) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(url);
  }
  const more = nav.getByRole("button", { name: "Más", exact: true });
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog").getByRole("combobox").or(page.getByRole("dialog").locator("input"))).toBeVisible();
  w.expectClean();
});

test("volver a una página con el mapa ya montado no congela la página", async ({ page }) => {
  // Next deja oculta la ruta que se abandona; al volver, el mapa se monta otra vez en el mismo contenedor.
  // Con reuseMaps de react-map-gl eso era un ciclo infinito y la pestaña dejaba de responder.
  const w = watchErrors(page);
  await page.goto("/red");
  await page.locator(".maplibregl-canvas").first().waitFor({ state: "attached", timeout: 30_000 });
  const nav = page.getByRole("navigation", { name: "Navegación principal", exact: true });
  await nav.getByRole("link", { name: "Envíos", exact: true }).click();
  await expect(page).toHaveURL(/\/envios$/);
  await nav.getByRole("link", { name: "Red", exact: true }).click();
  await expect(page).toHaveURL(/\/red$/);
  const alive = await Promise.race([
    page.evaluate(() => new Promise<string>((r) => requestAnimationFrame(() => r("ok")))),
    new Promise<string>((r) => setTimeout(() => r("congelada"), 8_000)),
  ]);
  expect(alive).toBe("ok");
  await expect(page.locator(".maplibregl-canvas").first()).toBeVisible();
  w.expectClean();
});

test("el resumen muestra la red en plano y el mapa 3D solo al pedirlo", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/");
  await expect(page.locator('svg[aria-label^="Red multimodal"]')).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Vista del mapa" }).getByRole("radio", { name: "3D" }).click();
  await page.locator(".maplibregl-canvas").first().waitFor({ state: "attached", timeout: 30_000 });
  await page.getByRole("radiogroup", { name: "Vista del mapa" }).getByRole("radio", { name: "Plano" }).click();
  await expect(page.locator('svg[aria-label^="Red multimodal"]')).toBeVisible();
  w.expectClean();
});

test("un envío que no existe responde 404", async ({ page }) => {
  const r = await page.goto("/envios/LS-0000-0000");
  expect(r?.status()).toBe(404);
  await expect(page.getByText("No encontramos lo que buscas")).toBeVisible();
  for (const path of ["/flota/999999", "/bodegas/999999"]) expect((await page.goto(path))?.status()).toBe(404);
});

test("los avisos se abren desde el dock en cualquier página", async ({ page }) => {
  await page.goto("/envios");
  const bell = page.getByRole("button", { name: /^Avisos/ });
  await bell.click();
  await expect(bell).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Requiere atención" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bell).toHaveAttribute("aria-expanded", "false");
});

test("Hoy: cifras, cuatro bloques y la fila lleva a la ficha del envío", async ({ page }, info) => {
  const w = watchErrors(page);
  await page.goto("/hoy");
  for (const name of ["Salen", "Llegan", "Por firmar", "Requiere atención"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath("hoy.png"), fullPage: true });
  const first = page.locator("section#salen a, section#llegan a").first();
  if (await first.count()) {
    await first.click();
    await page.waitForURL(/\/envios\/LS-/);
  }
  w.expectClean();
});
