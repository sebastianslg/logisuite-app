import { expect, test } from "./helpers";

/**
 * «Mis sesiones» en Configuración: la cuenta «pruebas» del fixture entra por cookie (sin token en el navegador), así
 * que esta prueba comprueba que el panel pregunta por su cuenta y se muestra igual. La lista marca la sesión actual y
 * «Cerrar las demás» pide confirmación en el propio botón, cierra las otras y deja solo la de este navegador.
 */
test("Configuración lista las sesiones abiertas y cierra las demás", async ({ page }) => {
  await page.goto("/configuracion");

  const titulo = page.getByRole("heading", { name: "Mis sesiones", exact: true });
  await expect(titulo).toBeVisible();

  const lista = page.getByRole("list", { name: "Sesiones abiertas" });
  await expect(lista.getByText("Esta sesión", { exact: true })).toBeVisible();

  // Otra sesión de la misma cuenta abierta fuera de este navegador (como otro equipo)
  const otra = await page.request.post("/api/auth/password", {
    data: { identifier: "pruebas", password: "pruebas-e2e-local" },
  });
  expect(otra.ok(), await otra.text()).toBe(true);

  // La lista se pidió al montar: se recarga la página para ver la sesión nueva. La suite entra en cada prueba, así que
  // puede haber más de una sesión ajena; lo que importa es que haya al menos dos antes de cerrar.
  await page.reload();
  await expect(titulo).toBeVisible();
  await expect.poll(async () => lista.getByRole("listitem").count()).toBeGreaterThan(1);

  const cerrar = page.getByRole("button", { name: "Cerrar las demás", exact: true });
  await expect(cerrar).toBeEnabled();
  await cerrar.click();

  // La confirmación vive en el mismo botón (no en un window.confirm)
  const confirmar = page.getByRole("button", { name: "Sí, cerrar las demás", exact: true });
  await expect(confirmar).toBeVisible();
  await confirmar.click();

  await expect(page.getByText(/Se cerr(ó|aron) /).first()).toBeVisible();

  // Queda solo la sesión de este navegador, marcada, y ya no hay otras que cerrar
  await expect(lista.getByRole("listitem")).toHaveCount(1);
  await expect(lista.getByText("Esta sesión", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar las demás", exact: true })).toBeDisabled();
});
