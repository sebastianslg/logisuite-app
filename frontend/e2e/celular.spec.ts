import { expect, test } from "@playwright/test";

import { noHorizontalOverflow, PAGES, watchErrors } from "./helpers";

test("en celular no hay desborde horizontal y el dock inferior funciona", async ({ page }) => {
  const w = watchErrors(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal (celular)" });
  await nav.getByRole("button", { name: /Más/ }).tap();
  const sheet = page.getByRole("dialog", { name: "Más secciones" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: /Historial/ }).tap();
  await expect(page).toHaveURL(/\/historial/);
  w.expectClean();
});
