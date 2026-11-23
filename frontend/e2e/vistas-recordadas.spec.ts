import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test, watchErrors } from "./helpers";

/**
 * Vistas recordadas por cuenta: la lista de envíos guarda en este navegador los filtros de estado y modo y la página,
 * y una URL limpia (`/envios`) los devuelve. La búsqueda nunca se guarda: puede traer el nombre de un cliente.
 *
 * El fixture de pruebas entra solo con la cookie, sin el token en el navegador, así que la app no sabe de qué cuenta
 * es la sesión y no recuerda nada. Aquí se copia la cookie al token para recorrer el mismo camino que el ingreso con
 * contraseña, que es el que deja el token en `localStorage`.
 */
const VISTAS = "westvane.vista.";

type Conteos = { total: number; counts: { status: Record<string, number> }; items: { code: string }[] };

/** Escapa un texto para usarlo dentro de una expresión regular. */
const rx = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/**
 * Deja la sesión de la prueba también como token y abre la lista cuando la app ya sabe de qué cuenta es: el hook no
 * lee ni escribe la vista hasta que `/api/auth/me` contesta.
 */
async function conCuenta(page: Page) {
  const token = (await page.context().cookies()).find((c) => c.name === "westvane_session")?.value;
  if (!token) throw new Error("la sesión de la prueba no dejó la cookie westvane_session");
  await page.addInitScript((t) => localStorage.setItem("westvane.session_token", t), token);
  const cuenta = page.waitForResponse((r) => r.url().includes("/api/auth/me") && r.ok());
  await page.goto("/envios");
  await cuenta;
}

/** Vistas guardadas en este navegador: clave (con la cuenta y la ruta) → querystring recordado. */
function vistas(page: Page) {
  return page.evaluate((prefijo) => {
    const salida: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i) ?? "";
      if (clave.startsWith(prefijo)) salida[clave] = localStorage.getItem(clave) ?? "";
    }
    return salida;
  }, VISTAS);
}

async function conteos(request: APIRequestContext): Promise<Conteos> {
  return (await (await request.get("/api/shipments?limit=1")).json()) as Conteos;
}

/** Estado con envíos; con `parcial`, además que deje algunos fuera para que el filtro se note en el total. */
function estadoConEnvios(datos: Conteos, parcial = false): [string, number] | undefined {
  return Object.entries(datos.counts.status)
    .filter(([, n]) => n > 0 && (!parcial || n < datos.total))
    .sort((a, b) => b[1] - a[1])[0];
}

test("envíos: estado y modo vuelven con la URL limpia; la búsqueda no se recuerda", async ({ page, request }) => {
  const w = watchErrors(page);
  await conCuenta(page);
  const { user_id } = await (await page.request.get("/api/auth/me")).json();

  const datos = await conteos(request);
  const elegido = estadoConEnvios(datos, true);
  if (!elegido) {
    test.skip(true, "la base de pruebas no tiene envíos en varios estados");
    return;
  }
  const [estado, enEstado] = elegido;

  const chipEstado = page.getByRole("group", { name: "Filtrar por estado" }).getByRole("button", { name: rx(estado) }).first();
  await chipEstado.click();
  await expect(chipEstado).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("estado")).toBe(estado);
  await expect(page.getByText(new RegExp(`de ${enEstado} envíos`)).first()).toBeVisible();

  // El modo también es parte de la vista y se acumula al estado
  const chipModo = page.getByRole("group", { name: "Filtrar por modo" }).getByRole("button", { name: rx("Terrestre") }).first();
  await chipModo.click();
  await expect(chipModo).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("modo")).toBe("terrestre");

  // Lo recordado es de esta cuenta y solo lleva la vista: ni rastro de la búsqueda
  const clave = `${VISTAS}${user_id}./envios`;
  const guardadas = await vistas(page);
  expect(Object.keys(guardadas)).toEqual([clave]);
  const guardado = new URLSearchParams(guardadas[clave]);
  expect(guardado.get("estado")).toBe(estado);
  expect(guardado.get("modo")).toBe("terrestre");
  expect(guardado.has("q")).toBe(false);

  // Una URL limpia (el enlace del dock o un marcador) devuelve la vista
  await page.goto("/envios");
  await expect.poll(() => new URL(page.url()).searchParams.get("estado")).toBe(estado);
  expect(new URL(page.url()).searchParams.get("modo")).toBe("terrestre");
  await expect(page.getByRole("group", { name: "Filtrar por estado" }).getByRole("button", { name: rx(estado) }).first())
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Filtrar por modo" }).getByRole("button", { name: rx("Terrestre") }).first())
    .toHaveAttribute("aria-pressed", "true");

  // La búsqueda sí va en la URL (se puede compartir), pero no entra en lo recordado
  const codigo = datos.items[0]?.code;
  if (codigo) {
    await page.getByRole("textbox", { name: "Buscar envíos" }).fill(codigo);
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(codigo);
    const trasBuscar = new URLSearchParams((await vistas(page))[clave] ?? "");
    expect(trasBuscar.get("estado")).toBe(estado);
    expect(trasBuscar.has("q")).toBe(false);
  }

  // Y al volver con la URL limpia está el filtro, nunca el texto buscado
  await page.goto("/envios");
  await expect.poll(() => new URL(page.url()).searchParams.get("estado")).toBe(estado);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  await expect(page.getByRole("textbox", { name: "Buscar envíos" })).toHaveValue("");
  w.expectClean();
});

test("envíos: la página vuelve con la URL limpia", async ({ page, request }) => {
  const w = watchErrors(page);
  await conCuenta(page);
  const { total } = await conteos(request);
  if (total <= 25) {
    test.skip(true, "la base de pruebas cabe en una sola página");
    return;
  }

  await expect(page.getByText(/Página 1 de \d+/).first()).toBeVisible();
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("pagina")).toBe("2");

  // Otra visita por la URL limpia abre la misma página
  await page.goto("/envios");
  await expect.poll(() => new URL(page.url()).searchParams.get("pagina")).toBe("2");
  await expect(page.getByText(/Página 2 de \d+/).first()).toBeVisible();
  w.expectClean();
});

test("envíos: «Limpiar» olvida la vista recordada", async ({ page, request }) => {
  const w = watchErrors(page);
  await conCuenta(page);
  const elegido = estadoConEnvios(await conteos(request));
  if (!elegido) {
    test.skip(true, "la base de pruebas no tiene envíos");
    return;
  }
  const [estado] = elegido;

  await page.getByRole("group", { name: "Filtrar por estado" }).getByRole("button", { name: rx(estado) }).first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("estado")).toBe(estado);
  await expect.poll(async () => Object.keys(await vistas(page)).length).toBe(1);

  // Quitar los filtros también borra lo recordado: la próxima visita limpia no los devuelve
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect.poll(async () => Object.keys(await vistas(page)).length).toBe(0);

  await page.goto("/envios");
  await expect(page.getByRole("group", { name: "Filtrar por estado" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  w.expectClean();
});
