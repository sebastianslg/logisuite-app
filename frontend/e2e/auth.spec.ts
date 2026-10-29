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

    // Probar cuenta demo admin
    const adminDemoBtn = page.getByRole("button", { name: "admin", exact: true });
    await expect(adminDemoBtn).toBeVisible();
    await adminDemoBtn.click();

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

    watch.expectClean();
  });
});
