import { expect, test, watchErrors } from "./helpers";

/** Escapa un texto para usarlo dentro de una expresión regular. */
const rx = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/**
 * Los filtros y el orden de la flota viven en la URL: se aplican al instante, dejan un enlace que se puede
 * compartir y una recarga devuelve la misma vista.
 */
test("flota: el filtro por estado y el orden quedan en la URL y se restauran al recargar", async ({ page, request }) => {
  const w = watchErrors(page);
  const items = (await (await request.get("/api/fleet/vehicles")).json()).items as { code: string; status: string }[];
  // El estado más frecuente: el chip siempre deja vehículos, sin depender de los datos de la base
  const counts = new Map<string, number>();
  for (const v of items) counts.set(v.status, (counts.get(v.status) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) {
    test.skip(true, "la base de pruebas no tiene vehículos");
    return;
  }
  const [estado] = top;
  const codigos = items.filter((v) => v.status === estado).map((v) => v.code);
  expect(codigos.length, "la base de pruebas no tiene vehículos en ningún estado").toBeGreaterThan(1);

  await page.goto("/flota");
  const grupoEstados = page.getByRole("group", { name: "Filtrar por estado" });
  const chip = grupoEstados.getByRole("button", { name: estado, exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("estado")).toBe(estado);
  await expect(page.getByText(new RegExp(`^${codigos.length} de ${items.length} vehículos$`)).first()).toBeVisible();

  // Orden por placa: la lista se reordena y el desplegable también queda en la URL
  await page.locator("main").getByRole("combobox", { name: /Ordenar por/ }).selectOption("placa");
  await expect.poll(() => new URL(page.url()).searchParams.get("orden")).toBe("placa");

  // El enlace lleva las dos cosas juntas
  const sp = new URL(page.url()).searchParams;
  expect(sp.get("estado")).toBe(estado);
  expect(sp.get("orden")).toBe("placa");

  // Al recargar con ese enlace, el chip sigue marcado, el orden sigue elegido y la lista está ordenada por placa
  await page.reload();
  await expect(page.getByRole("group", { name: "Filtrar por estado" }).getByRole("button", { name: estado, exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main").getByRole("combobox", { name: /Ordenar por/ })).toHaveValue("placa");
  await expect(page.getByText(new RegExp(`^${codigos.length} de ${items.length} vehículos$`)).first()).toBeVisible();

  const placas = page.locator("main ul.rule-list a[href^='/flota/'] .font-mono");
  await expect(placas).toHaveCount(codigos.length);
  const enOrden = await placas.evaluateAll((els) =>
    els.map((e) => e.textContent ?? "").every((p, i, a) => i === 0 || a[i - 1] <= p),
  );
  expect(enOrden, "la lista no quedó ordenada por placa").toBe(true);
  w.expectClean();
});

/** Lo mismo en bodegas: el filtro por rol (un chip) queda en la URL y se restaura. */
test("bodegas: el filtro por rol queda en la URL y se restaura al recargar", async ({ page, request }) => {
  const w = watchErrors(page);
  const roles = (await (await request.get("/api/warehouses/roles")).json()).items as { key: string; label: string }[];
  const items = (await (await request.get("/api/warehouses")).json()).items as { role: string }[];
  const cuenta = (key: string) => items.filter((w) => w.role === key).length;
  // Un rol que deje bodegas fuera: el filtro se nota en la lista
  const role = roles.filter((r) => cuenta(r.key) > 0 && cuenta(r.key) < items.length).sort((a, b) => cuenta(b.key) - cuenta(a.key))[0];
  if (!role) {
    test.skip(true, "la base de pruebas no tiene bodegas de varios roles");
    return;
  }

  await page.goto("/bodegas");
  const grupoRoles = page.getByRole("group", { name: "Filtrar por rol" });
  const chip = grupoRoles.getByRole("button", { name: rx(role.label) });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("rol")).toBe(role.key);
  await expect(page.getByText(new RegExp(`^${cuenta(role.key)} de ${items.length} bodegas en \\d+ ciudades$`)).first()).toBeVisible();

  // Al recargar con ese enlace, el chip sigue marcado y la lista queda filtrada
  await page.reload();
  await expect(page.getByRole("group", { name: "Filtrar por rol" }).getByRole("button", { name: rx(role.label) }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(new RegExp(`^${cuenta(role.key)} de ${items.length} bodegas en \\d+ ciudades$`)).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("rol")).toBe(role.key);
  w.expectClean();
});

/** Un enlace viejo o editado a mano con valores que ya no existen: se ignoran y la página no se rompe. */
test("flota: valores inválidos en la URL se ignoran sin romper la página", async ({ page, request }) => {
  const w = watchErrors(page);
  const items = (await (await request.get("/api/fleet/vehicles")).json()).items as { code: string }[];
  test.skip(items.length === 0, "la base de pruebas no tiene vehículos");

  await page.goto("/flota?estado=Inventado&modo=x&orden=nada&alertas=2&q=");
  await expect(page.getByRole("group", { name: "Filtrar por estado" })).toBeVisible();
  await expect(page.locator("main ul.rule-list a[href^='/flota/']").first()).toBeVisible();
  await expect(page.getByText(new RegExp(`^${items.length} de ${items.length} vehículos$`)).first()).toBeVisible();
  // Lo inválido no activó ningún filtro y el orden volvió al de siempre
  const sp = new URL(page.url()).searchParams;
  expect(sp.get("estado")).toBe("Inventado");   // la URL no se reescribe sola: la página solo la ignora
  await expect(page.locator("main").getByRole("combobox", { name: /Ordenar por/ })).toHaveValue("defecto");
  w.expectClean();
});
