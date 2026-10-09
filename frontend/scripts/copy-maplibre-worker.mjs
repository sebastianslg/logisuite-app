// Copia el worker de MapLibre a public/vendor/.
//
// MapLibre 6 resuelve la URL de su worker relativa al módulo que lo importa;
// una vez empaquetado por Next/Turbopack esa ruta no existe y el mapa base
// falla con "Worker failed to load". Se publica el worker como asset estático
// y Map3D lo indica con maplibregl.setWorkerUrl(). Se ejecuta en predev y
// prebuild, así el archivo siempre corresponde a la versión instalada.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// El paquete solo exporta ESM: se resuelve con import.meta.resolve
const src = join(dirname(fileURLToPath(import.meta.resolve("maplibre-gl"))), "maplibre-gl-worker.mjs");
const destDir = join(root, "public", "vendor");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "maplibre-gl-worker.mjs"));
console.log("maplibre-gl-worker.mjs -> public/vendor/");
