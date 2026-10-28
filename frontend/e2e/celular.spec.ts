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
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal (celular)" });
  await nav.getByRole("button", { name: /Más/ }).tap();
  const sheet = page.getByRole("dialog", { name: "Más secciones" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: /Historial/ }).tap();
  await expect(page).toHaveURL(/\/historial/);
  w.expectClean();
});
