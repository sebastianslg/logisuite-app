// node scripts/rendimiento.mjs http://127.0.0.1:3177 resultado.json [ruta ...]
// Servidor de producción local y API sembrada de e2e. No se escriben credenciales en el informe.
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { E2E_BROWSER, withSession } from "../e2e/helpers.ts";

const [baseURL, salida, ...seleccion] = process.argv.slice(2);
if (!salida || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
  throw Error("Indica una URL local y el archivo JSON de salida.");
}
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "msedge", args: ["--enable-precise-memory-info"] });
const informe = { navegador: browser.version(), rutas: [], bucle: null };
const guardar = () => writeFile(salida, JSON.stringify(informe, null, 2));
const opts = { baseURL, viewport: { width: 1400, height: 900 }, locale: "es-CO", timezoneId: "America/Bogota", serviceWorkers: "block" };
const soloJS = process.env.PERF_SOLO_JS === "1";
try {
  const inicial = await browser.newContext(opts);
  await withSession(await inicial.newPage(), baseURL);
  const legal = await (await inicial.request.get("/api/legal")).json();
  if (!(await inicial.request.post("/api/consents", { data: { browser_id: E2E_BROWSER, subject: "Pruebas", context: "primer_uso",
    items: ["terminos", "privacidad"].map(d => ({ document: d, version: legal.versions[d], text: "Aceptación de prueba local" })) } })).ok()) throw Error("No se pudo preparar el consentimiento");
  opts.storageState = await inicial.storageState();
  opts.storageState.origins = [{ origin: new URL(baseURL).origin, localStorage: [{ name: "westvane.browser-id", value: E2E_BROWSER }] }];
  const lista = await (await inicial.request.get("/api/shipments?limit=1")).json();
  await inicial.close();
  const rutas = seleccion.length ? seleccion : ["/panel", "/envios", `/envios/${lista.items[0].code}`, "/red", "/flota", "/hoy", "/bodegas", "/clientes", "/historial", "/configuracion", "/auditoria", "/calendario", "/comparar", "/vias", "/huella", "/combustible", "/cotizacion"];
  for (const ruta of rutas) {
    const ctx = await browser.newContext(opts);
    try {
      const page = await ctx.newPage();
      // Pasada separada: el perfilador de rangos de V8 altera tiempos. No contaminar LCP/INP con él.
      if (soloJS) await page.coverage.startJSCoverage();
      await page.addInitScript(() => {
        const m = window.medida = { lcp: null, cls: 0, largas: [], clic: null, dibujos: 0, ultimo: null };
        const obs = (type, cb, extra = {}) => new PerformanceObserver(list => list.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra });
        obs("largest-contentful-paint", e => { m.lcp = e.startTime; });
        obs("layout-shift", e => { if (!e.hadRecentInput) m.cls += e.value; });
        obs("longtask", e => { if (e.startTime < 10000) m.largas.push(e.duration); });
        obs("event", e => { if (e.name === "click") m.clic = e.duration; }, { durationThreshold: 16 });
        // Contamos cuadros con dibujo real, no el rAF del navegador ni una captura de una red vacía.
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          for (const nombre of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
            const fn = proto[nombre];
            if (!fn) continue;
            proto[nombre] = function (...args) {
              if (this.canvas?.isConnected && m.ultimo !== document.timeline.currentTime) { m.dibujos++; m.ultimo = document.timeline.currentTime; }
              return fn.apply(this, args);
            };
          }
        }
      });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Performance.enable");
      await cdp.send("Network.enable");
      const recursos = new Map();
      cdp.on("Network.responseReceived", e => recursos.set(e.requestId, { js: e.type === "Script" || /javascript/.test(e.response.mimeType), bytes: 0 }));
      cdp.on("Network.loadingFinished", e => { const r = recursos.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
      const response = await page.goto(ruta, { waitUntil: "domcontentloaded" });
      if (!response?.ok() || new URL(page.url()).pathname !== ruta) throw Error("Ruta no disponible o redirigida");
      if (soloJS) {
        await page.waitForLoadState("load");
        const inicial = [...recursos.values()].reduce((s, r) => s + (r.js ? r.bytes : 0), 0);
        await page.waitForFunction(() => performance.now() >= 2000);
        const cobertura = (await page.coverage.stopJSCoverage()).filter(s => s.url.startsWith(baseURL) && s.source);
        let usado = 0, disponible = 0;
        for (const s of cobertura) {
          disponible += Buffer.byteLength(s.source);
          // inner (más específico) gana a outer; V8 puede devolver funciones/bloques anidados no ejecutados.
          const eventos = s.functions.flatMap(f => f.ranges).flatMap(r => [
            { at: r.startOffset, inicio: true, r }, { at: r.endOffset, inicio: false, r },
          ]).sort((a, b) => a.at - b.at || Number(a.inicio) - Number(b.inicio));
          const activos = new Set();
          let prev = 0;
          for (const e of eventos) {
            if (prev < e.at && [...activos].sort((a, b) => (a.endOffset-a.startOffset) - (b.endOffset-b.startOffset))[0]?.count) {
              usado += Buffer.byteLength(s.source.slice(prev, e.at));
            }
            if (e.inicio) activos.add(e.r); else activos.delete(e.r);
            prev = e.at;
          }
        }
        informe.rutas.push({ ruta, jsInicialBytes: inicial, jsEjecutadoBytes: usado, jsFuenteBytes: disponible });
        continue;
      }
      await page.waitForFunction(() => performance.now() >= 10000);
      const row = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0], m = window.medida;
        return { ttfb: nav.responseStart, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
          lcp: m.lcp, cls: m.cls, largas: m.largas.length, maxima: Math.max(0, ...m.largas) };
      });
      const r = [...recursos.values()];
      Object.assign(row, { peticiones: r.length, bytes: r.reduce((s, v) => s + v.bytes, 0), jsBytes: r.reduce((s, v) => s + (v.js ? v.bytes : 0), 0),
        jsMs: 1000 * (await cdp.send("Performance.getMetrics")).metrics.find(m => m.name === "ScriptDuration").value });
      if (ruta === "/red") {
        const a = await page.evaluate(() => window.medida.dibujos);
        await page.waitForTimeout(5000);
        const b = await page.evaluate(() => window.medida.dibujos);
        row.cuadrosReposo = a > 0 ? b - a : null;
        row.canvas = await page.locator("canvas").count();
      }
      // Primer control común de solo lectura: abrir el menú. Un evento <16 ms no tiene entrada Event Timing.
      const control = page.getByRole("button", { name: /^Más\b/ }).filter({ visible: true }).first();
      if (await control.count()) {
        await control.click({ timeout: 4000 });
        await page.waitForTimeout(300);
        row.inpAprox = await page.evaluate(() => window.medida.clic ?? "<16 ms");
      } else row.inpAprox = null;
      informe.rutas.push({ ruta, ...row });
    } catch (e) { informe.rutas.push({ ruta, error: e.message.split("\n")[0] }); }
    finally { await ctx.close(); await guardar(); }
  }
  if (!soloJS) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto("/panel");
  const ciclo = async () => {
    for (const ruta of (process.env.PERF_BUCLE ?? "/envios,/red,/flota,/panel").split(",")) {
      await page.locator(`nav a[href="${ruta}"]:visible`).first().click();
      await page.waitForURL(`**${ruta}`);
      await page.waitForTimeout(1800);
    }
  };
  const memoria = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return page.evaluate(() => performance.memory.usedJSHeapSize);
  };
  await ciclo(); // carga los mismos módulos antes de comparar memoria retenida
  const inicio = await memoria(), muestras = [];
  for (let i = 0; i < 5; i++) { await ciclo(); muestras.push(await memoria()); }
  informe.bucle = { inicio, muestras, crecimientoPct: (muestras.at(-1) / inicio - 1) * 100 };
  await guardar();
  }
} finally { await browser.close(); }
