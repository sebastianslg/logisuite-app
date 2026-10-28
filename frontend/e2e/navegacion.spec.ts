import { expect, test } from "@playwright/test";

import { PAGES, watchErrors } from "./helpers";

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
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
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

test("volver al resumen con el mapa ya montado no congela la página", async ({ page }) => {
  // Next deja oculta la ruta que se abandona; al volver, el mapa se monta otra vez en el mismo contenedor.
  // Con reuseMaps de react-map-gl eso era un ciclo infinito y la pestaña dejaba de responder.
  const w = watchErrors(page);
  await page.goto("/");
  await page.locator(".maplibregl-canvas").first().waitFor({ state: "attached", timeout: 30_000 });
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "Envíos", exact: true }).click();
  await expect(page).toHaveURL(/\/envios$/);
  await nav.getByRole("link", { name: "Resumen", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const alive = await Promise.race([
    page.evaluate(() => new Promise<string>((r) => requestAnimationFrame(() => r("ok")))),
    new Promise<string>((r) => setTimeout(() => r("congelada"), 8_000)),
  ]);
  expect(alive).toBe("ok");
  await expect(page.locator(".maplibregl-canvas").first()).toBeVisible();
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
