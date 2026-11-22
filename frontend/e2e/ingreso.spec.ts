import { expect, test, watchErrors } from "./helpers";

const SIN_SESION = { annotation: { type: "sin-sesion" } };

test("sin sesión la app lleva a ingresar; lo público sigue abierto", SIN_SESION, async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto("/envios?estado=Retrasado");
  await expect(page).toHaveURL(/\/ingresar\?next=%2Fenvios%3Festado%3DRetrasado/);
  await expect(page.getByRole("heading", { name: "Ingresar a Westvane" })).toBeVisible();

  for (const open of ["/", "/terminos", "/metodologia"]) {
    await page.goto(open);
    await expect(page).toHaveURL(new RegExp(`${open === "/" ? "/$" : open}`));
  }
  watch.expectClean();
});

test("con usuario y contraseña entra y vuelve a la página pedida", SIN_SESION, async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto("/flota");
  await expect(page).toHaveURL(/\/ingresar/);

  await page.getByLabel("Usuario o correo").fill("pruebas");
  await page.getByLabel("Contraseña", { exact: true }).fill("no-es-esta-clave");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrectos" })).toHaveText("Usuario, correo o contraseña incorrectos.");

  await page.getByLabel("Contraseña", { exact: true }).fill("pruebas-e2e-local");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/flota$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // Recargar no vuelve a pedir el ingreso
  await page.reload();
  await expect(page).toHaveURL(/\/flota$/);
  // El 422 es el de la contraseña equivocada que la prueba escribe a propósito
  expect(watch.errors.filter((e) => !/status of 422/.test(e)), watch.errors.join("\n")).toEqual([]);
});

test("también entra con el correo de la cuenta", SIN_SESION, async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByLabel("Usuario o correo").fill("pruebas@westvane.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("pruebas-e2e-local");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/panel$/);
});


test("Configuración: cambiar mi contraseña (y dejarla como estaba)", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/configuracion");
  const titulo = page.getByText("Mi contraseña", { exact: true });
  await expect(titulo).toBeVisible();

  const actual = page.getByLabel("Contraseña actual");
  const nueva = page.getByLabel(/^Nueva/);
  const repetir = page.getByLabel("Repetir la nueva");
  const boton = page.getByRole("button", { name: /Cambiar contraseña/ });

  // Las dos nuevas deben coincidir (validación local, sin llamar a la API)
  await actual.fill("pruebas-e2e-local");
  await nueva.fill("clave-nueva-123");
  await repetir.fill("otra-cosa");
  await boton.click();
  await expect(page.getByText(/no coinciden/)).toBeVisible();

  // Cambio real
  await repetir.fill("clave-nueva-123");
  await boton.click();
  await expect(actual).toHaveValue("");            // el formulario se vacía solo cuando el servidor aceptó el cambio

  // Y se devuelve a la de pruebas para no romper los demás casos
  await actual.fill("clave-nueva-123");
  await nueva.fill("pruebas-e2e-local");
  await repetir.fill("pruebas-e2e-local");
  await boton.click();
  await expect(actual).toHaveValue("");            // sin esto la prueba terminaría antes de que se guardara la vieja
  await expect(page.getByText("Contraseña cambiada").first()).toBeVisible();
  w.expectClean();
});
