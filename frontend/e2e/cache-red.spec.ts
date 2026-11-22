import { expect, test, watchErrors } from "./helpers";

/**
 * La red multimodal y los departamentos casi no cambian: la API los entrega con ETag y el proxy de Next reenvía el
 * validador en los dos sentidos. Sin eso el navegador nunca recibiría el 304 y volvería a bajar ~150 KB en cada visita.
 */
for (const ruta of ["/api/network/multimodal", "/api/geo/departments"]) {
  test(`${ruta}: el ETag llega al navegador y If-None-Match devuelve 304 vacío`, async ({ request }) => {
    const primera = await request.get(ruta);
    expect(primera.status()).toBe(200);
    const etag = primera.headers()["etag"];
    expect(etag, "el proxy debe devolver el ETag de la API").toBeTruthy();
    expect(primera.headers()["cache-control"]).toContain("no-cache");

    const segunda = await request.get(ruta, { headers: { "if-none-match": etag } });
    expect(segunda.status()).toBe(304);
    expect((await segunda.body()).length).toBe(0);

    // Un validador que no es el vigente trae el contenido completo otra vez
    const ajena = await request.get(ruta, { headers: { "if-none-match": '"otro"' } });
    expect(ajena.status()).toBe(200);
  });
}

test("la red se vuelve a abrir (con revalidación) sin errores", async ({ page }) => {
  const w = watchErrors(page);
  // Se espera el mapa de deck.gl, no el lienzo de MapLibre: en equipos de 4 hilos o 4 GB el mapa base no se monta
  // (y esta prueba no depende de él). La marca la pone deck.gl al cargar.
  const mapa = () =>
    page.locator('[data-testid="mapa-colombia"][data-map-ready="1"]').first().waitFor({ state: "attached", timeout: 30_000 });
  await page.goto("/red");
  await mapa();
  // La segunda visita revalida con If-None-Match: si el 304 llegara roto, el mapa no cargaría la red
  await page.reload();
  await mapa();
  w.expectClean();
});
