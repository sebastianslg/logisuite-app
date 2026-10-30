import { expect, test, watchErrors } from "./helpers";

test.describe("Autenticación sin contraseña por correo (OTP)", () => {
  test("flujo completo: solicitar código, ingresar código y cerrar sesión", async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Abrir el popover de "Más" en el dock para ver el acceso de cuenta
    const moreBtn = page.getByRole("button", { name: "Más", exact: true });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
    }

    // Botón para ingresar con código al correo
    const loginTrigger = page.getByRole("button", { name: /ingresar con código al correo/i });
    await expect(loginTrigger).toBeVisible();
    await loginTrigger.click();

    // El modal de autenticación debe estar visible
    const modalTitle = page.getByRole("heading", { name: /acceso institucional/i });
    await expect(modalTitle).toBeVisible();

    // El correo se escribe a mano (no hay cuentas de demostración). La semilla usa un dominio reservado, que no existe.
    await page.getByLabel("Correo electrónico").fill("admin@westvane.invalid");
    await page.getByRole("button", { name: /enviar código/i }).click();

    // Debe avanzar al paso de verificación de código de 6 dígitos
    const codeInput = page.getByPlaceholder("123456");
    await expect(codeInput).toBeVisible();

    // En entorno local, se muestra el botón "Usar código"
    const useCodeBtn = page.getByRole("button", { name: /usar código/i });
    await expect(useCodeBtn).toBeVisible();
    await useCodeBtn.click();

    // Hacer clic en Ingresar
    const submitBtn = page.getByRole("button", { name: /ingresar/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // El modal debe cerrarse tras autenticar con éxito
    await expect(modalTitle).toBeHidden();

    // Si abrimos de nuevo Más, debe mostrar el usuario autenticado
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
    }
    const userStatus = page.getByText(/usuario autenticado/i);
    await expect(userStatus).toBeVisible();

    // Recargar la página para verificar que la sesión persiste vía token y /api/auth/me
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
    }
    await expect(page.getByText(/usuario autenticado/i)).toBeVisible();

    // Abrir detalles de cuenta y cerrar sesión
    const cuentaBtn = page.getByRole("button", { name: "Cuenta", exact: true });
    await expect(cuentaBtn).toBeVisible();
    await cuentaBtn.click();

    const logoutBtn = page.getByRole("button", { name: /cerrar sesión/i });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Tras cerrar sesión, debe volver a mostrar el botón para ingresar
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
    }
    await expect(page.getByRole("button", { name: /ingresar con código al correo/i })).toBeVisible();

    watch.expectClean();
  });
});

test.describe("Administración de usuarios y empresas", () => {
  test("sin sesión pide ingresar; como administrador crea una empresa y un usuario y le cambia el rol", async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto("/administracion");
    await expect(page.getByText("Inicia sesión para administrar", { exact: true })).toBeVisible();

    // Entrar como el administrador de la semilla (en las pruebas el código viaja en la respuesta: WESTVANE_DEV_OTP=1)
    await page.getByRole("button", { name: /ingresar con código al correo/i }).click();
    await page.getByLabel("Correo electrónico").fill("admin@westvane.invalid");
    await page.getByRole("button", { name: /enviar código/i }).click();
    await page.getByRole("button", { name: /usar código/i }).click();
    await page.getByRole("button", { name: /^ingresar$/i }).click();
    await expect(page.getByRole("heading", { name: /^Usuarios/ })).toBeVisible();

    const stamp = Date.now();
    await page.getByLabel("Nombre de la empresa").fill(`Empresa de prueba ${stamp}`);
    await page.getByRole("button", { name: "Agregar empresa" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: `Empresa de prueba ${stamp}` })).toBeVisible();

    await page.getByLabel("Nombre completo").fill(`Persona ${stamp}`);
    await page.getByLabel("Correo", { exact: true }).fill(`persona${stamp}@ejemplo.invalid`);
    await page.getByRole("button", { name: "Crear usuario" }).click();
    const row = page.getByRole("listitem").filter({ hasText: `Persona ${stamp}` });
    await expect(row).toBeVisible();

    await row.getByRole("combobox").selectOption("lector");
    await expect(row.getByRole("combobox")).toHaveValue("lector");
    watch.expectClean();
  });
});

test("administración: desactivar y volver a activar a un usuario", async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto("/administracion");
  await page.getByRole("button", { name: /ingresar con código al correo/i }).click();
  await page.getByLabel("Correo electrónico").fill("admin@westvane.invalid");
  await page.getByRole("button", { name: /enviar código/i }).click();
  await page.getByRole("button", { name: /usar código/i }).click();
  await page.getByRole("button", { name: /^ingresar$/i }).click();
  await expect(page.getByRole("heading", { name: /^Usuarios/ })).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: "Consulta Gerencial" });
  // Uno mismo no tiene botón para desactivarse
  await expect(page.getByRole("listitem").filter({ hasText: "Administrador del Sistema" }).getByRole("button", { name: "Desactivar" })).toHaveCount(0);

  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Desactivar" }).click();
  await expect(row.getByText("Inactivo")).toBeVisible();
  await row.getByRole("button", { name: "Activar" }).click();
  await expect(row.getByText("Inactivo")).toBeHidden();
  watch.expectClean();
});
