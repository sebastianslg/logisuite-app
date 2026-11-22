import { expect, test, watchErrors } from "./helpers";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * La paleta (Ctrl K) suma a los comandos y a lo ya cargado una sección «Resultados» con lo que devuelve /api/search.
 * Con parte de un código de envío real se comprueba que aparece esa sección, que las flechas y Enter la recorren y
 * que al elegir se abre la ficha del envío.
 */
test("la paleta busca en el servidor y abre el envío elegido con el teclado", async ({ page }) => {
  const watch = watchErrors(page);

  const { items } = await (await page.request.get("/api/shipments?limit=1")).json();
  expect(items.length, "hace falta al menos un envío en la base de pruebas").toBeGreaterThan(0);
  const codigo: string = items[0].code;
  // Parte del código sin las dos primeras letras (los envíos se numeran como LS-2610-00001): sirve para probar la
  // búsqueda por fragmento y sigue siendo casi único, así que el envío aparece entre los primeros resultados.
  const fragmento = codigo.length > 4 ? codigo.slice(2) : codigo;

  await page.goto("/panel");
  // El dock ya hidrató (el atajo Ctrl K lo escucha la app montada)
  await expect(page.getByRole("status").filter({ hasText: /Sistema en línea|Sin conexión/ }).first()).toBeVisible();
  await page.keyboard.press("Control+k");

  const dialogo = page.getByRole("dialog", { name: "Buscar o ejecutar un comando" });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("combobox").fill(fragmento);

  // La sección llega después del retardo de 250 ms y de la API
  await expect(dialogo.getByText("Resultados", { exact: true }).first()).toBeVisible();
  const opciones = dialogo.getByRole("option");
  await expect(opciones.filter({ hasText: codigo }).first()).toBeVisible();

  // Flechas y Enter: se baja hasta la fila del envío (puede no ser la primera si el fragmento coincide con varios)
  // y Enter abre su ficha.
  const indice = await opciones.evaluateAll(
    (nodos, texto) => nodos.findIndex((n) => (n.textContent ?? "").includes(texto)),
    codigo,
  );
  expect(indice, "la búsqueda debía traer el código escrito").toBeGreaterThanOrEqual(0);
  if (indice === 0) {
    await page.keyboard.press("ArrowDown");
    if ((await opciones.count()) > 1) await page.keyboard.press("ArrowUp");
  } else {
    for (let i = 0; i < indice; i++) await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`/envios/${escapeRegExp(codigo)}(?:[?#].*)?$`));
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  watch.expectClean();
});
