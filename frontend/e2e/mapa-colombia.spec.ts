import type { Page } from "@playwright/test";

import { expect, test } from "./helpers";

/**
 * El mapa de Colombia no depende de la red externa para funcionar: la silueta y la máscara salen de los
 * departamentos (DANE), y los estilos claro/oscuro mínimos son archivos locales que se usan sin mapa base o como
 * respaldo si OpenFreeMap falla. Estas pruebas cortan cualquier petición externa y comprueban:
 *
 *  - en un equipo de 4 hilos o 4 GB el mapa arranca sin mapa base (sin segundo lienzo WebGL y sin teselas);
 *  - con solo WebGL1 (deck.gl 9 pide WebGL2) el mapa cae a la red plana sin intentar montar deck.gl;
 *  - si el estilo del mapa base carga pero sus teselas fallan después, la silueta local vuelve a pintarse;
 *  - el interruptor «Mapa base» enciende MapLibre, recuerda la elección y, sin red, cae al estilo local avisando;
 *  - sin localStorage la elección del mapa base vale en la visita (y no sobrevive a recargar);
 *  - en oscuro se pide el estilo oscuro (o su respaldo local) y en claro el claro;
 *  - la cámara no sale de Colombia ni de los límites de zoom, inclinación ni giro.
 *
 * Además deja cuatro capturas (claro/oscuro × con/sin mapa base) cuando se corre con MAPA_CAPTURAS=1:
 *
 *   MAPA_CAPTURAS=1 npx playwright test e2e/mapa-colombia.spec.ts
 *
 * Los archivos quedan en test-results/mapa-{claro|oscuro}-{con|sin}-base.png.
 */

/** Corta lo externo y devuelve la lista de URL que se intentaron pedir fuera de la app. */
async function sinRedExterna(page: Page) {
  const externas: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (!/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) {
        externas.push(url.href);
        return route.abort();
      }
    }
    return route.continue();
  });
  return externas;
}

const MAPA = '[data-testid="mapa-colombia"][data-map-ready="1"]';

/** Arrastra desde el centro del mapa (dx positivo mueve el contenido a la derecha; el centro va al oeste). */
async function arrastrar(page: Page, dx: number, dy = 0) {
  const caja = await page.getByTestId("mapa-colombia").boundingBox();
  if (!caja) throw new Error("el mapa no tiene caja");
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}

test("equipo modesto: el mapa arranca sin mapa base, sin teselas y con la atribución", async ({ page }) => {
  const externas = await sinRedExterna(page);
  await page.addInitScript(() => {
    // Cuatro hilos y 4 GB: el caso que no debe sostener un segundo lienzo WebGL
    try {
      Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 4 });
      Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 4 });
    } catch {
      /* si el navegador no lo deja, la preferencia explícita de abajo manda */
    }
    localStorage.removeItem("westvane:map-base");
    localStorage.removeItem("westvane:map-quality");
  });

  await page.goto("/red");
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });

  // Sin MapLibre: un solo lienzo (deck.gl) y ninguna petición de teselas o estilos
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  await expect(page.getByTestId("mapa-atribucion")).toHaveText("Límites departamentales: DANE · MGN 2018");
  expect(externas, `peticiones externas: ${externas.join(" · ")}`).toEqual([]);
});

test("con solo WebGL1 el mapa cae a la red plana sin montar deck.gl", async ({ page }) => {
  await page.addInitScript(() => {
    // deck.gl 9 dibuja con WebGL2. Se simula un equipo con WebGL1 y sin WebGL2: debe quedar la red plana con su
    // aviso, sin intentar siquiera descargar el trozo del mapa.
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2") return null;
      return (original as unknown as (this: HTMLCanvasElement, type: string, ...args: unknown[]) => unknown).call(this, type, ...rest);
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/red");
  const gl = await page.evaluate(() => ({
    webgl2: Boolean(document.createElement("canvas").getContext("webgl2")),
    webgl1: Boolean(document.createElement("canvas").getContext("webgl")),
  }));
  expect(gl.webgl2, "la prueba simula un equipo sin WebGL2").toBe(false);
  expect(gl.webgl1, "el equipo sí tiene WebGL1").toBe(true);

  await expect(page.getByRole("status").filter({ hasText: "no puede dibujar el mapa 3D" })).toBeVisible({ timeout: 30_000 });
  // La red plana sigue: ni contenedor de deck.gl ni lienzo de MapLibre
  await expect(page.locator('[data-testid="mapa-colombia"]')).toHaveCount(0);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
});

test("si las teselas fallan después del estilo, la silueta local sigue y se avisa", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("westvane:map-base", "on");
    localStorage.setItem("westvane:map-quality", "alta");
    localStorage.setItem("westvane.theme", "light");
  });
  // El estilo carga (MapLibre avisa «load»), pero su fuente de teselas no responde: es un servidor de teselas caído
  // con el estilo aún disponible. Sin la silueta de deck.gl, el país quedaría en el color del mar.
  const estilo = {
    version: 8,
    name: "Prueba con teselas caídas",
    sources: {
      base: {
        type: "vector",
        tiles: ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf"],
        minzoom: 0,
        maxzoom: 14,
      },
    },
    layers: [
      { id: "mar", type: "background", paint: { "background-color": "#eef1f4" } },
      { id: "tierra", type: "fill", source: "base", "source-layer": "land", paint: { "fill-color": "#ffffff" } },
    ],
  };
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/styles/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(estilo) });
    }
    if ((url.protocol === "http:" || url.protocol === "https:") && !/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) {
      return route.abort();
    }
    return route.continue();
  });

  await page.goto("/red");
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "teselas del mapa base no cargaron" })).toBeVisible({ timeout: 30_000 });
  // La silueta, la máscara y los datos vuelven a salir de deck.gl sobre el mar del estilo
  await expect(page.getByTestId("mapa-colombia")).toHaveAttribute("data-map-land", "local");
});

test("sin localStorage, el interruptor del mapa base responde en la visita y no persiste", async ({ page }) => {
  await sinRedExterna(page);
  await page.addInitScript(() => {
    // Cuatro hilos y 4 GB: el mapa base arranca apagado, así se ve la elección de la visita
    try {
      Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 4 });
      Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 4 });
    } catch {
      /* si el navegador no lo deja, el respaldo en memoria se prueba igual con el interruptor */
    }
    // Modo privado estricto: el almacenamiento existe pero toda operación falla. Se deja pasar el id de navegador
    // que siembra el fixture (la aceptación de términos depende de él).
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (this: Storage, key: string) {
      if (key === "westvane.browser-id") return originalGet.call(this, key);
      throw new DOMException("almacenamiento bloqueado", "SecurityError");
    };
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (key === "westvane.browser-id") return originalSet.call(this, key, value);
      throw new DOMException("almacenamiento bloqueado", "SecurityError");
    };
    Storage.prototype.removeItem = function () {
      throw new DOMException("almacenamiento bloqueado", "SecurityError");
    };
  });

  await page.goto("/red");
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });
  const boton = page.getByTestId("mapa-base");
  await expect(boton).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);

  // Sin almacenamiento, el cambio de la visita sí responde (antes no hacía nada)
  await boton.click();
  await expect(boton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);

  // Y al recargar vuelve el valor del equipo: no se guardó nada
  await page.reload();
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });
  await expect(page.getByTestId("mapa-base")).toHaveAttribute("aria-pressed", "false");
});

test("el interruptor enciende el mapa base, cae al estilo local sin red y lo recuerda", async ({ page }) => {
  await sinRedExterna(page);
  await page.addInitScript(() => {
    // addInitScript se evalúa en cada navegación, también en page.reload(): la preferencia se siembra solo si aún no
    // existe, para no pisar la elección que la app guardó (la gracia de esta prueba es que la recarga la conserve).
    try {
      if (localStorage.getItem("westvane:map-base") === null) localStorage.setItem("westvane:map-base", "off");
      if (localStorage.getItem("westvane:map-quality") === null) localStorage.setItem("westvane:map-quality", "alta");
    } catch {
      /* sin almacenamiento la app usa sus valores por defecto y las comprobaciones de abajo lo delatan */
    }
  });

  await page.goto("/red");
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });
  const boton = page.getByTestId("mapa-base");
  await expect(boton).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);

  // Con la red externa cortada, OpenFreeMap no carga: el mapa cae al estilo local claro y avisa. La cartografía
  // de deck.gl nunca desaparece y la atribución se mantiene.
  const respaldo = page.waitForRequest((r) => r.url().endsWith("/mapa-colombia-claro.json"), { timeout: 20_000 });
  await boton.click();
  await respaldo;
  await expect(boton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "mapa base no cargó" })).toBeVisible();
  await expect(page.getByTestId("mapa-atribucion")).toHaveText("Límites departamentales: DANE · MGN 2018");
  expect(await page.evaluate(() => localStorage.getItem("westvane:map-base"))).toBe("on");

  // La elección sobrevive a una recarga: no hay que volver a encenderlo
  await page.reload();
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("westvane:map-base"))).toBe("on");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByTestId("mapa-base")).toHaveAttribute("aria-pressed", "true");
});

test("en oscuro pide el estilo local oscuro", async ({ page }) => {
  await sinRedExterna(page);
  await page.addInitScript(() => {
    localStorage.setItem("westvane.theme", "dark");
    localStorage.setItem("westvane:map-base", "on");
    localStorage.setItem("westvane:map-quality", "alta");
  });

  const oscuro = page.waitForRequest((r) => r.url().endsWith("/mapa-colombia-oscuro.json"), { timeout: 20_000 });
  await page.goto("/red");
  await oscuro;
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  // La interfaz está en oscuro y el mapa no se queda en blanco si OpenFreeMap no responde
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("status").filter({ hasText: "mapa base no cargó" })).toBeVisible();
});

test("la cámara queda dentro de Colombia y de los límites de zoom, inclinación y giro", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("westvane:map-base", "off");
    localStorage.setItem("westvane:map-quality", "alta");
  });
  await page.goto("/red");
  const mapa = page.getByTestId("mapa-colombia");
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });

  const numero = async (atributo: string) => Number(await mapa.getAttribute(atributo));
  const dentro = async () => {
    const [lng, lat, zoom, pitch, bearing] = await Promise.all(
      ["data-lng", "data-lat", "data-zoom", "data-pitch", "data-bearing"].map(numero),
    );
    return { lng, lat, zoom, pitch, bearing };
  };

  // El encuadre inicial ya está dentro de la caja de la cámara
  const inicial = await dentro();
  expect(inicial.lng).toBeGreaterThanOrEqual(-82.6);
  expect(inicial.lng).toBeLessThanOrEqual(-66.2);
  expect(inicial.lat).toBeGreaterThanOrEqual(-5.2);
  expect(inicial.lat).toBeLessThanOrEqual(13.8);
  expect(inicial.zoom).toBeGreaterThanOrEqual(3.4);
  expect(inicial.zoom).toBeLessThanOrEqual(9);
  expect(inicial.pitch).toBeGreaterThanOrEqual(0);
  expect(inicial.pitch).toBeLessThanOrEqual(60);
  expect(inicial.bearing).toBeGreaterThanOrEqual(-40);
  expect(inicial.bearing).toBeLessThanOrEqual(40);

  const caja = await mapa.boundingBox();
  if (!caja) throw new Error("el mapa no tiene caja");
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);

  // Alejar mucho se detiene en el mínimo; acercar mucho, en el máximo
  for (let i = 0; i < 16; i++) await page.mouse.wheel(0, 600);
  await expect.poll(async () => numero("data-zoom")).toBeCloseTo(3.4, 1);
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -600);
  await expect.poll(async () => numero("data-zoom")).toBeCloseTo(9, 1);

  // Volver a una escala de país y arrastrar de más: el centro se detiene en los bordes, no hay copias del mundo
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 600);
  for (let i = 0; i < 4; i++) await arrastrar(page, -900);
  await expect.poll(async () => numero("data-lng")).toBeCloseTo(-66.2, 1);
  for (let i = 0; i < 8; i++) await arrastrar(page, 900);
  await expect.poll(async () => numero("data-lng")).toBeCloseTo(-82.6, 1);

  // Girar e inclinar de más (Ctrl + arrastre) tampoco pasa los topes
  await page.keyboard.down("Control");
  await arrastrar(page, 900);
  await arrastrar(page, 0, 900);
  await page.keyboard.up("Control");
  const girada = await dentro();
  expect(girada.bearing).toBeGreaterThanOrEqual(-40);
  expect(girada.bearing).toBeLessThanOrEqual(40);
  expect(girada.pitch).toBeGreaterThanOrEqual(0);
  expect(girada.pitch).toBeLessThanOrEqual(60);
});

test("si el mapa base falla del todo, quedan la cartografía propia, la atribución y el aviso", async ({ page }) => {
  // Se cortan OpenFreeMap y también el estilo local: MapLibre no pinta nada, pero deck.gl sigue dibujando la
  // tierra, la máscara y los datos, y la atribución y el aviso no desaparecen (nunca una pantalla vacía).
  await sinRedExterna(page);
  await page.route("**/mapa-colombia-*.json", (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("westvane:map-base", "on");
    localStorage.setItem("westvane:map-quality", "alta");
  });
  await page.goto("/red");
  await page.locator(MAPA).first().waitFor({ timeout: 30_000 });
  await expect(page.getByTestId("mapa-atribucion")).toHaveText("Límites departamentales: DANE · MGN 2018");
  await expect(page.getByRole("status").filter({ hasText: "mapa base no cargó" })).toBeVisible();
});

/**
 * Capturas para revisar el mapa en los cuatro estados. No corre en la suite normal.
 * El interruptor es [data-testid="mapa-base"] y el contenedor [data-testid="mapa-colombia"].
 * La preferencia se guarda en «westvane:map-base» ("on" | "off"); el tema en «westvane.theme».
 */
test.describe("capturas del mapa", () => {
  test.skip(process.env.MAPA_CAPTURAS !== "1", "se corre solo con MAPA_CAPTURAS=1");
  test.describe.configure({ mode: "serial" });

  for (const tema of ["claro", "oscuro"] as const) {
    for (const base of ["con", "sin"] as const) {
      test(`${tema} · ${base} mapa base`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.addInitScript(
          ({ tema, base }: { tema: "claro" | "oscuro"; base: "con" | "sin" }) => {
            localStorage.setItem("westvane.theme", tema === "oscuro" ? "dark" : "light");
            localStorage.setItem("westvane:map-base", base === "con" ? "on" : "off");
            localStorage.setItem("westvane:map-quality", "alta");
          },
          { tema, base },
        );

        await page.goto("/red");
        await page.locator(MAPA).first().waitFor({ timeout: 30_000 });
        if (base === "con") {
          await page.locator(".maplibregl-canvas").first().waitFor({ state: "attached", timeout: 30_000 });
        }
        // La cartografía entra por etapas: se deja terminar antes de la captura
        await expect(page.getByTestId("mapa-base")).toHaveAttribute("aria-pressed", base === "con" ? "true" : "false");
        const ocultar = page.getByRole("button", { name: "Ocultar simulador" });
        if (await ocultar.count()) await ocultar.click();
        await page.waitForTimeout(2_500);
        await page.getByTestId("mapa-colombia").screenshot({
          path: `test-results/mapa-${tema}-${base}-base.png`,
          animations: "disabled",
        });
      });
    }
  }
});
