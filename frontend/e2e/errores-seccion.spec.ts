import { expect, test } from "./helpers";

/**
 * Un fallo de una sección no puede tumbar la ficha de envío. La red del mapa se pide desde el navegador,
 * así que su lectura se puede cortar con `page.route` y comprobar que solo esa sección avisa, que el resto
 * de la ficha sigue en pie y que «Reintentar» la vuelve a pedir sin recargar la página.
 *
 * (La bitácora, el historial, los adjuntos y la entrega llegan pintados por el servidor: un `page.route`
 * del navegador no los alcanza; su fallo se marca en `page.tsx` con `Promise.allSettled`.)
 */
test("si falla una sección, solo esa avisa y se puede reintentar", async ({ page, request }) => {
  const created = await request.post("/api/shipments", {
    data: {
      origin: "Bogotá",
      destination: "Tunja",
      cargo: "Prueba de error por sección",
      weight_t: 3,
      client: "QA",
      priority: "costo",
      forced_modes: ["terrestre"],
      usuario: "Prueba",
      departure_at: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 16),
    },
  });
  expect(created.status()).toBe(201);
  const code = (await created.json()).code as string;

  try {
    // Solo se corta la red del mapa; el envío y las demás secciones cargan con normalidad
    await page.route("**/api/network/multimodal", (route) => route.abort());
    await page.goto(`/envios/${code}`);

    const aviso = page.getByRole("alert").filter({ hasText: "No pudimos cargar el mapa." });
    await expect(aviso).toBeVisible();

    // La ficha entera sigue en pantalla: encabezado, bitácora y documentos
    await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bitácora" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documentos adjuntos" })).toBeVisible();

    // Se suelta la lectura y «Reintentar» la vuelve a pedir: el aviso se va y la red vuelve a pintarse
    await page.unroute("**/api/network/multimodal");
    const relectura = page.waitForResponse((r) => r.url().includes("/api/network/multimodal") && r.ok());
    await aviso.getByRole("button", { name: "Reintentar" }).click();
    await relectura;
    await expect(aviso).toBeHidden();
  } finally {
    await request.delete(`/api/shipments/${code}?usuario=Prueba`);
  }
});
