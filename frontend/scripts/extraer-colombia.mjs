// Requiere la CLI pmtiles de Protomaps. No activa la cartografía ni sobrescribe archivos.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, linkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [origen, destino] = process.argv.slice(2);
if (!origen || !destino || existsSync(destino)) throw Error("Indica un archivo PMTiles de origen (o URL) y un destino que no exista.");
const region = fileURLToPath(new URL("../../backend/app/data/colombia_departamentos.geojson", import.meta.url));
const dir = mkdtempSync(join(dirname(resolve(destino)), ".colombia-"));
const archivo = join(dir, "colombia.pmtiles");
const cli = process.env.PMTILES_BIN || "pmtiles";
function run(...args) {
  const r = spawnSync(cli, args, { stdio: "inherit" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(`Falló pmtiles ${args[0]}`);
}
try {
  run("extract", origen, archivo, `--region=${region}`, "--maxzoom=11", "--download-threads=4");
  run("verify", archivo);
  linkSync(archivo, resolve(destino));
} finally { rmSync(dir, { recursive: true, force: true }); }
