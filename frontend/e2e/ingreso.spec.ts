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
