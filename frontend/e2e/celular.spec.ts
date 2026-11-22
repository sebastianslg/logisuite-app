import { expect, noHorizontalOverflow, PAGES, test, watchErrors } from "./helpers";

test("en celular no hay desborde horizontal y el dock inferior funciona", async ({ page }) => {
  const w = watchErrors(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await noHorizontalOverflow(page);
  }
  // Y en un teléfono angosto (375 px, como un iPhone SE o mini), donde los desbordes aparecen primero
  await page.setViewportSize({ width: 375, height: 740 });
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 412, height: 839 });
  await page.goto("/panel");
  const nav = page.getByRole("navigation", { name: "Navegación principal (celular)" });
  await nav.getByRole("button", { name: /Más/ }).tap();
  const sheet = page.getByRole("dialog", { name: "Más secciones" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: /Historial/ }).tap();
  await expect(page).toHaveURL(/\/historial/);
  w.expectClean();
});

for (const [ancho, tema] of [[320, "dark"], [390, "light"]] as const) {
  test(`sesiones, ayudas y envíos caben a ${ancho} px (${tema})`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.addInitScript(t => localStorage.setItem("westvane.theme", t), tema);
    await page.goto("/configuracion");
    await expect(page.getByRole("heading", { name: "Mis sesiones", exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("dialog", { name: "Atajos de teclado" })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await noHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    for (const ruta of ["/envios", "/flota?q=lista-vacia-77", "/bodegas?q=lista-vacia-77"]) {
      await page.goto(ruta);
      await expect(page.locator("main h1").first()).toBeVisible();
      await noHorizontalOverflow(page);
    }
  });
}
