// node scripts/comparar-rendimiento.mjs antes.json despues.json js-antes.json js-despues.json [salida.md]
// Emite Markdown para la bitácora; normaliza únicamente el código de la ficha de la base de ejemplo.
import { readFile, writeFile } from "node:fs/promises";

const [a, d, ja, jd] = await Promise.all(process.argv.slice(2, 6).map(async f => JSON.parse(await readFile(f, "utf8"))));
const salida = process.argv[6];
const lineas = [];
const log = (...partes) => lineas.push(partes.join(" "));
const ruta = p => p.replace(/^\/envios\/LS-[\d-]+$/, "/envios/[code]");
const fila = (x, p) => x?.rutas.find(r => ruta(r.ruta) === p) ?? {};
const n = (v, dec = 0) => typeof v === "number" ? v.toFixed(dec).replace(".", ",") : v ?? "N/D";
const par = (x, y, k, dec, div = 1) => [x[k], y[k]].map(v => n(typeof v === "number" ? v / div : v, dec)).join(" → ");
log("| Ruta | TTFB ms | FCP ms | LCP ms | CLS¹ | Clic ms | JS (KiB) | CPU JS ms | Peticiones | Total KiB | Largas | Mayor ms |");
log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const x of a.rutas) {
  const p = ruta(x.ruta), y = fila(d, p);
  log(`| \`${p}\` | ${[["ttfb"], ["fcp"], ["lcp"], ["cls", 4], ["inpAprox"], ["jsBytes", 1, 1024], ["jsMs"], ["peticiones"], ["bytes", 1, 1024], ["largas"], ["maxima"]].map(args => par(x, y, ...args)).join(" | ")} |`);
}
log("\n¹ Suma conservadora de desplazamientos sin entrada reciente en la ventana de 10 s. Clic: Event Timing, no INP de campo.\n");
log("| Ruta | JS al cargar (KiB) | Variación | Fuente ejecutada a 2 s (KiB) |");
log("|---|---:|---:|---:|");
for (const x of ja.rutas) {
  const p = ruta(x.ruta), y = fila(jd, p);
  log(`| \`${p}\` | ${par(x, y, "jsInicialBytes", 1, 1024)} | ${x.jsInicialBytes && y.jsInicialBytes ? n(100 * (y.jsInicialBytes / x.jsInicialBytes - 1), 1) + " %" : "N/D"} | ${par(x, y, "jsEjecutadoBytes", 1, 1024)} |`);
}
log(`\nMemoria retenida tras 20 navegaciones: ${par(a.bucle ?? {}, d.bucle ?? {}, "crecimientoPct", 1)} %. Cuadros WebGL de la red en 5 s en reposo: ${par(fila(a, "/red"), fila(d, "/red"), "cuadrosReposo")}.`);
const texto = lineas.join("\n") + "\n";
if (salida) await writeFile(salida, texto, "utf8");
else process.stdout.write(texto);
