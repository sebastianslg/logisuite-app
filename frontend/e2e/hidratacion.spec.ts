import http from "node:http";
import type { AddressInfo } from "node:net";

import { expect, test, watchErrors } from "./helpers";

/**
 * Un límite de Suspense que llega tarde en el flujo HTML se hidrata después del armazón. Si mientras tanto el armazón
 * ya trajo datos del navegador (la ventana de aceptación pide el estado de privacidad), el primer render del bloque
 * debe seguir dando lo mismo que el servidor; si no, React lanza el error #418 y vuelve a pintar la página.
 *
 * En las pruebas normales eso dependía de lo lenta que estuviera la API con la base de pruebas acumulada. Aquí un
 * proxy entrega el armazón y retiene el resto de la página (desde el segmento `<div hidden id="S:…">` del panel) hasta
 * que el navegador ya recibió el estado de privacidad. Los ids de `useId` dicen si React hidrató el HTML del servidor
 * (`_R_…`) o lo volvió a pintar (`_r_…`, lo que dejó una vez campos duplicados en `/flota/<id>/editar`).
 */
const MARK = "Privacidad y aceptaciones";

async function delayingProxy(target: string) {
  let consentServed!: () => void;
  const consent = new Promise<void>((r) => (consentServed = r));
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  let holds = 0;
  const server = http.createServer((req, res) => {
    const up = http.request(new URL(req.url ?? "/", target), { method: req.method, headers: { ...req.headers, host: new URL(target).host, "accept-encoding": "identity" } }, (upRes) => {
      // La página se reenvía en otro tamaño de trozos: sin content-length
      const headers = { ...upRes.headers };
      delete headers["content-length"];
      res.writeHead(upRes.statusCode ?? 502, headers);
      const isPage = (upRes.headers["content-type"] ?? "").includes("text/html");
      if (req.url?.startsWith("/api/consents?")) upRes.on("end", () => setTimeout(consentServed, 300));
      // La TRM llega después del panel: si llegara antes, el panel recibiría otro contexto y React lo pintaría de
      // cero sin comparar con el HTML (eso ocultaría la diferencia que esta prueba busca)
      if (req.url?.startsWith("/api/settings")) return void released.then(() => setTimeout(() => upRes.pipe(res), 1_000));
      if (!isPage) return void upRes.pipe(res);
      // La API local responde rápido: se junta la página entera y se corta antes del segmento del panel
      const parts: Buffer[] = [];
      upRes.on("data", (c: Buffer) => parts.push(c));
      upRes.on("end", () => {
        const html = Buffer.concat(parts).toString("utf8");
        const at = html.lastIndexOf('<div hidden id="S:', html.indexOf(MARK));
        if (at < 0) return void res.end(html);
        res.write(html.slice(0, at));
        holds++;
        // Sin respuesta en 8 s se suelta igual: la prueba falla por la aserción, no por un cuelgue
        void Promise.race([consent, new Promise((r) => setTimeout(r, 8_000))]).then(() => {
          res.end(html.slice(at));
          release();
        });
      });
    });
    up.on("error", () => res.destroy());
    req.pipe(up);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, holds: () => holds, close: () => server.close() };
}

test("Configuración hidrata sin diferencias aunque el estado de privacidad llegue antes que el panel", async ({ page, baseURL }) => {
  const proxy = await delayingProxy(baseURL!);
  try {
    const w = watchErrors(page);
    await page.goto(`${proxy.url}/configuracion`);
    await expect(page.getByText(/Aceptado · versión/).first()).toBeVisible();
    // El panel se hidrató sobre el HTML del servidor (ids `_R_…`) en vez de pintarse de nuevo (`_r_…`), y nada quedó duplicado
    await expect(page.getByRole("heading", { name: "Tasa de cambio (TRM)" })).toHaveCount(1);
    const ids = await page.locator("main [id^='_']").evaluateAll((els) => els.map((e) => e.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !id.startsWith("_R_")), "el panel se volvió a pintar en el navegador").toEqual([]);
    expect(proxy.holds(), "el proxy no encontró el segmento del panel").toBe(1);
    w.expectClean();
  } finally {
    proxy.close();
  }
});
