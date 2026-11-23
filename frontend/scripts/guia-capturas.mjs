// Capturas del tutorial de docs/entrega/guia.html (claro, 1280×800, datos de ejemplo). Necesita la app corriendo con
// WESTVANE_DEV_OTP=1 (cuenta «pruebas»): GUIA_BASE=http://127.0.0.1:3188 BRAND_CHANNEL=msedge node scripts/guia-capturas.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BASE = process.env.GUIA_BASE ?? "http://127.0.0.1:3000";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/entrega/capturas");
const post = (url, body) => fetch(BASE + url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const login = await (await post("/api/auth/password", { identifier: "pruebas", password: "pruebas-e2e-local" })).json();
const legal = await (await fetch(BASE + "/api/legal")).json();
const BID = "guia-000000000000000000000001";
await post("/api/consents", { browser_id: BID, subject: "Guía", context: "primer_uso",
  items: ["terminos", "privacidad"].map((d) => ({ document: d, version: legal.versions[d], text: "ok" })) });
const list = await (await fetch(BASE + "/api/shipments?limit=30", { headers: { Authorization: `Bearer ${login.token}` } })).json();
const ship = (list.items.find((s) => s.status === "En Ruta" && s.modes.length > 1) ?? list.items[0]).code;
const veh = (await (await fetch(BASE + "/api/fleet/vehicles", { headers: { Authorization: `Bearer ${login.token}` } })).json()).items[0].id;

const browser = await chromium.launch(process.env.BRAND_CHANNEL ? { channel: process.env.BRAND_CHANNEL } : {});
async function shoot(name, url, { mobile = false, before, wait = 1800, session = true } = {}) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: mobile ? 2 : 1.5, locale: "es-CO", timezoneId: "America/Bogota", colorScheme: "light" });
  if (session) await ctx.addCookies([{ name: "westvane_session", value: login.token, url: BASE }]);
  await ctx.addInitScript((id) => { if (!localStorage.getItem("westvane.browser-id")) localStorage.setItem("westvane.browser-id", id); }, BID);
  const p = await ctx.newPage();
  await p.goto(BASE + url, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(wait);
  if (before) await before(p);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
  console.log(name);
}

await shoot("01-presentacion", "/", { session: false });
await shoot("02-ingresar", "/ingresar", { session: false });
await shoot("03-torre", "/panel");
await shoot("04-red", "/red", { wait: 3500 });
await shoot("05-red-ruta", "/red", { wait: 3500, before: async (p) => {
  await p.getByRole("button", { name: "Simular ruta" }).click();
  await p.waitForTimeout(4500);
} });
await shoot("06-envios", "/envios");
await shoot("07-ficha", `/envios/${encodeURIComponent(ship)}`);
await shoot("08-nuevo", "/envios/nuevo");
await shoot("09-flota", "/flota");
await shoot("10-vehiculo", `/flota/${veh}`);
await shoot("11-hoy", "/hoy");
await shoot("12-bodegas", "/bodegas");
await shoot("13-buscar", "/panel", { before: async (p) => { await p.keyboard.press("Control+k"); await p.waitForTimeout(900); await p.keyboard.type("bog"); await p.waitForTimeout(1200); } });
await shoot("14-configuracion", "/configuracion");
await shoot("15-celular", "/panel", { mobile: true });
await browser.close();
