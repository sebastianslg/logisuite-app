import type { Page } from "@playwright/test";

import { expect, test } from "./helpers";

/**
 * Ayuda de atajos: «?» abre la hoja «Atajos de teclado» en las páginas de la app, Esc la cierra y el foco vuelve a
 * donde estaba. En la portada pública «?» no hace nada y dentro de un campo de texto se escribe el signo, sin abrir
 * la ayuda. La distribución de teclado de Chromium en las pruebas es la de EE. UU.: «?» es Shift+/.
 */
const dialogNamed = (page: Page) => page.getByRole("dialog", { name: "Atajos de teclado" });

/** La app ya hidrató: el dock consulta el estado al montar y deja de decir «Verificando…». */
async function hydrated(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /Sistema en línea|Sin conexión/ }).first()).toBeVisible();
}

/** Configuración ya hidrató sus paneles: la sección de privacidad leyó lo aceptado en este navegador. */
async function settingsReady(page: Page) {
  await hydrated(page);
  await expect(page.getByText(/Aceptado · versión/).first()).toBeVisible();
}

test("«?» abre los atajos en el resumen, Esc los cierra y el foco vuelve", async ({ page }) => {
  await page.goto("/panel");
  await hydrated(page);

  // Un elemento estable con el foco: al cerrar, el foco debe volver aquí y no quedarse en el body.
  const search = page.getByRole("button", { name: "Buscar envíos, ciudades o comandos" });
  await search.focus();
  await expect(search).toBeFocused();

  await page.keyboard.press("Shift+Slash");

  const dialog = dialogNamed(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2, name: "Atajos de teclado" })).toBeVisible();
  // La lista enseña la búsqueda y cómo volver a abrir esta ayuda
  await expect(dialog.getByText("Ctrl", { exact: true })).toBeVisible();
  await expect(dialog.getByText("K", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Ver estos atajos", { exact: true })).toBeVisible();
  // Diálogo modal: el foco entra en la hoja (el botón de cerrar) y el Tab no se escapa a la página
  const close = dialog.getByRole("button", { name: "Cerrar" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(search).toBeFocused();
});

test("en la portada pública «?» no abre la ayuda", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main h1").first()).toBeVisible();

  await page.keyboard.press("Shift+Slash");
  // Margen para que un panel abierto por error alcance a montarse antes de comprobar que no está
  await page.waitForTimeout(300);
  await expect(dialogNamed(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("«?» dentro de un campo se escribe y no abre la ayuda", async ({ page }) => {
  await page.goto("/configuracion");
  await settingsReady(page);

  const rate = page.getByLabel("COP por USD");
  await rate.fill("");
  await rate.focus();
  await page.keyboard.press("Shift+Slash");

  await expect(rate).toHaveValue("?");
  await page.waitForTimeout(300);
  await expect(dialogNamed(page)).toHaveCount(0);
});

test("Configuración ofrece un botón visible para abrir los atajos", async ({ page }) => {
  await page.goto("/configuracion");
  await settingsReady(page);

  const open = page.getByRole("button", { name: "Atajos de teclado" });
  await open.click();

  const dialog = dialogNamed(page);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});
