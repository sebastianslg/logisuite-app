import { expect, test, watchErrors } from "./helpers";

/**
 * Accesibilidad de los tres flujos clave con lector de pantalla y teclado: ingresar, crear un envío y registrar la
 * entrega. Comprueban el orden del foco, que cada campo tenga nombre, que los errores se anuncien una sola vez y que
 * el éxito quede en una región viva (`role="status"`).
 */
const SIN_SESION = { annotation: { type: "sin-sesion" } };

test("ingresar: el Tab recorre los campos en orden y el error se anuncia una sola vez", SIN_SESION, async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/ingresar");

  const identifier = page.getByLabel("Usuario o correo");
  const password = page.getByLabel("Contraseña", { exact: true });
  const show = page.getByRole("button", { name: "Mostrar contraseña" });
  const submit = page.getByRole("button", { name: "Ingresar", exact: true });

  // El foco entra en el primer campo sin tocar el mouse
  await expect(identifier).toBeFocused();

  // Solo con el teclado: usuario → contraseña → mostrar/ocultar → Ingresar
  await page.keyboard.type("pruebas");
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.type("no-es-esta-clave");
  await page.keyboard.press("Tab");
  await expect(show).toBeFocused();
  await expect(show).toHaveAttribute("aria-pressed", "false");
  await expect(submit).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");

  // Un único aviso con el mensaje del servidor, atado al campo de la contraseña (sin repetir el texto en otro sitio).
  // Se filtra por el texto: el anunciador de rutas de Next también usa role="alert".
  const alert = page.getByRole("alert").filter({ hasText: "Usuario, correo o contraseña incorrectos." });
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveText("Usuario, correo o contraseña incorrectos.");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  const describedBy = await password.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText("Usuario, correo o contraseña incorrectos.");
  // El botón deshabilitado soltó el foco: vuelve al campo de usuario, no al logo.
  await expect(identifier).toBeFocused();

  // El 422 es la contraseña equivocada que esta prueba escribe a propósito
  expect(w.errors.filter((e) => !/status of 422/.test(e)), w.errors.join("\n")).toEqual([]);
});

test("ingresar: un `next` manipulado no saca a otro sitio", SIN_SESION, async ({ page, baseURL }) => {
  const w = watchErrors(page);
  // `/\evil.com` lo trata el navegador como `//evil.com`: sin validar el origen, location.assign salía del sitio.
  await page.goto("/ingresar?next=%2F%5Cevil.com");
  await page.getByLabel("Usuario o correo").fill("pruebas");
  await page.getByLabel("Contraseña", { exact: true }).fill("pruebas-e2e-local");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();

  await expect(page).toHaveURL(/\/panel$/);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
  w.expectClean();
});

test("envío nuevo: los errores se anuncian una vez y el foco va al primer campo con error", async ({ page }) => {
  const w = watchErrors(page);
  await page.goto("/envios/nuevo");
  // La lista de ciudades llega al hidratar: con opciones, el formulario ya escucha las teclas
  await expect.poll(() => page.locator("form select").first().locator("option").count()).toBeGreaterThan(3);

  // Cada campo tiene nombre accesible (etiqueta visible asociada)
  await expect(page.getByRole("combobox", { name: "Origen" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Destino" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Prioridad" })).toBeVisible();
  for (const name of ["Carga", "Cliente", "Peso (t)", "Retraso operativo (h)"]) {
    await expect(page.getByRole("textbox", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("textbox", { name: "Buscar vía para forzar" })).toBeVisible();

  const cargo = page.getByRole("textbox", { name: "Carga", exact: true });
  const client = page.getByRole("textbox", { name: "Cliente", exact: true });
  await page.getByRole("button", { name: /Crear envío/ }).click();

  // Un solo aviso, con el resumen de los campos que faltan. Se filtra por el texto porque el anunciador de rutas de
  // Next también usa role="alert".
  const alert = page.getByRole("alert").filter({ hasText: "Hay 2 campos por corregir" });
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveText("Hay 2 campos por corregir: Carga y Cliente.");

  // El foco va al primero y su mensaje está atado con aria-describedby
  await expect(cargo).toBeFocused();
  await expect(cargo).toHaveAttribute("aria-invalid", "true");
  await expect(client).toHaveAttribute("aria-invalid", "true");
  const describedBy = await cargo.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText("Describe la carga");

  // Al corregir, el aviso se retira
  await cargo.fill("Café de prueba");
  await client.fill("Cliente de prueba");
  await expect(alert).toHaveCount(0);
  w.expectClean();
});

test("crear un envío: el éxito se anuncia en una región viva", async ({ page, request }) => {
  const w = watchErrors(page);
  let code = "";
  try {
    await page.goto("/envios/nuevo");
    await expect.poll(() => page.locator("form select").first().locator("option").count()).toBeGreaterThan(3);
    await page.getByRole("textbox", { name: "Carga", exact: true }).fill("Envío de prueba de lector");
    await page.getByRole("textbox", { name: "Cliente", exact: true }).fill("Cliente de prueba");
    await page.getByRole("button", { name: /Crear envío/ }).click();

    const live = page.getByRole("status").filter({ hasText: /creado/ });
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toBeVisible();

    await page.waitForURL(/\/envios\/LS-[\d-]+$/);
    code = page.url().split("/").pop()!;
    await expect(live).toContainText(`Envío ${code} creado`);
  } finally {
    if (code) await request.delete(`/api/shipments/${code}?usuario=Prueba`).catch(() => {});
  }
  w.expectClean();
});

test("registrar entrega: es un diálogo con nombre y Esc lo cierra devolviendo el foco", async ({ page, request }) => {
  const list = await (await request.get("/api/shipments?status=Entregado")).json();
  let code = "";
  for (const s of list.items as { code: string }[]) {
    if ((await (await request.get(`/api/shipments/${s.code}/delivery`)).json()).can_record) {
      code = s.code;
      break;
    }
  }
  test.skip(!code, "no hay envíos entregados sin entrega registrada");

  const w = watchErrors(page);
  await page.goto(`/envios/${code}`);
  const open = page.getByRole("button", { name: "Registrar entrega" });
  await open.click();

  const dialog = page.getByRole("dialog", { name: "Registrar entrega" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Recibe (nombre completo)")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  w.expectClean();
});
