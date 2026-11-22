import { expect, test, watchErrors } from "./helpers";

/**
 * El dock muestra quién está cuando hay sesión y ofrece «Cerrar sesión» directo en el menú de cuenta.
 * Sin sesión (el fixture entra solo con la cookie, sin token en el navegador) queda como siempre: el acceso
 * de cuenta vive en «Más», con «Ingresar con código al correo».
 */
test.describe("Cuenta en el dock", () => {
  test("ingresa con código, muestra nombre y rol, y cierra sesión desde el menú de cuenta", async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto("/panel");
    await page.waitForLoadState("domcontentloaded");

    // Sin sesión conocida por el navegador: se entra por el acceso de cuenta del menú «Más»
    const moreBtn = page.getByRole("button", { name: "Más", exact: true });
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();
    await page.getByRole("button", { name: /ingresar con código al correo/i }).click();

    // Código al correo con el administrador de la semilla (WESTVANE_DEV_OTP=1 lo muestra y hay botón «Usar código»)
    await page.getByLabel("Correo electrónico").fill("admin@westvane.invalid");
    await page.getByRole("button", { name: /enviar código/i }).click();
    await page.getByRole("button", { name: /usar código/i }).click();
    await page.getByRole("button", { name: /^ingresar$/i }).click();
    await expect(page.getByRole("heading", { name: /acceso institucional/i })).toBeHidden();

    // El dock muestra quién está: nombre y rol junto al avatar de la cuenta. El rol se lee de la misma sesión
    // (role_label y, si el servidor aún no lo manda, el nombre en español del rol).
    const token = await page.evaluate(() => localStorage.getItem("westvane.session_token"));
    expect(token).toBeTruthy();
    const me = await (await page.request.get("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })).json();
    const role =
      me.role_label ||
      ({ admin: "Administrador", operador: "Operador", lector: "Lector" } as Record<string, string>)[me.role as string] ||
      me.role;
    const cuenta = page.getByRole("button", { name: /cuenta de administrador del sistema/i });
    await expect(cuenta).toBeVisible();
    await expect(cuenta.getByText("Administrador del Sistema", { exact: true })).toBeVisible();
    await expect(cuenta.getByText(role, { exact: true })).toBeVisible();

    // En el menú de cuenta, «Cerrar sesión» está directo (sin pasar por «Cuenta»)
    await cuenta.click();
    const menu = page.getByRole("group", { name: "Cuenta" });
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Administrador del Sistema", { exact: true })).toBeVisible();
    await expect(menu.getByText(role, { exact: true })).toBeVisible();

    const logout = menu.getByRole("button", { name: /cerrar sesión/i });
    await expect(logout).toBeVisible();
    await logout.click();

    // Tras cerrar sesión la app vuelve a la pantalla de ingreso (el flujo ya existente en lib/auth.ts)
    await expect(page).toHaveURL(/\/ingresar/);
    await expect(page.getByRole("heading", { name: "Ingresar a Westvane" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("westvane.session_token"))).toBeNull();
    watch.expectClean();
  });
});
