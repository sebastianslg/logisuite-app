import { expect, test } from "./helpers";

/**
 * Configuración medía 0,092 de CLS con el presupuesto en 0,05: el `<Suspense>` pintaba un esqueleto de 640 px que
 * después se cambiaba por un panel de más de 4.000 (al llegar, todo lo que quedaba debajo se movía) y «Mis sesiones»
 * aparecía y crecía al cargar, empujando otra vez el resto. Ahora el esqueleto tiene la forma y el alto del panel, el
 * contenedor reserva al menos una pantalla y el panel de sesiones ocupa su sitio desde el primer HTML.
 *
 * Se mide igual que `scripts/rendimiento.mjs`: el observador de `layout-shift` se instala antes de navegar (con
 * `buffered`, para no perder ningún desplazamiento), se descartan las entradas con interacción reciente (como el CLS
 * de campo) y se suma hasta 2 s después de `load` y del panel en pantalla. Si falla, el mensaje trae los nodos que se
 * movieron y sus rectángulos, para no tener que adivinar.
 */

/** Un nodo que se movió, con su rectángulo antes y después (como lo entrega `layout-shift`). */
interface Atribucion {
  node: Node | null;
  previousRect: { x: number; y: number; width: number; height: number };
  currentRect: { x: number; y: number; width: number; height: number };
}

interface Desplazamiento extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources: Atribucion[];
}

interface MedidaCls {
  /** Suma de los desplazamientos sin interacción reciente. */
  total: number;
  /** `performance.now()` hasta el que se mide; 0 mientras no llegue `load`. */
  hasta: number;
  entradas: { valor: number; en: number; fuentes: string[] }[];
}

declare global {
  interface Window {
    __clsConfiguracion?: MedidaCls;
    /** Corre el final de la ventana a 2 s desde ahora (el panel ya está en pantalla). */
    __clsVentana?: () => void;
  }
}

test("Configuración carga sin saltos (CLS < 0,05) y «Mis sesiones» sigue funcionando", async ({ page }) => {
  await page.addInitScript(() => {
    const medida: MedidaCls = { total: 0, hasta: 0, entradas: [] };
    window.__clsConfiguracion = medida;
    // La ventana se cierra 2 s después de `load` o del último aviso de «el panel ya está», lo que llegue más tarde
    window.__clsVentana = () => {
      medida.hasta = Math.max(medida.hasta, performance.now() + 2_000);
    };

    const caja = (r: { x: number; y: number; width: number; height: number }) =>
      `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`;
    const nombre = (n: Node | null) => {
      if (!n) return "sin nodo";
      if (n.nodeType !== Node.ELEMENT_NODE) return `texto(${n.nodeName})`;
      const el = n as Element;
      const clases = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${clases ? `.${clases}` : ""}`;
    };

    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries() as Desplazamiento[]) {
        if (entrada.hadRecentInput) continue;
        medida.total += entrada.value;
        medida.entradas.push({
          valor: entrada.value,
          en: Math.round(entrada.startTime),
          fuentes: entrada.sources.map((f) => `${nombre(f.node)} ${caja(f.previousRect)} → ${caja(f.currentRect)}`),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });

    window.addEventListener("load", () => window.__clsVentana?.());
  });

  await page.goto("/configuracion", { waitUntil: "load" });
  // El panel real (no el esqueleto) ya está en pantalla: desde aquí, 2 s más de medida
  await expect(page.getByRole("heading", { name: "Tasa de cambio (TRM)", exact: true })).toBeVisible();
  await page.evaluate(() => window.__clsVentana?.());

  await page.waitForFunction(
    () => {
      const medida = window.__clsConfiguracion;
      return !!medida && medida.hasta > 0 && performance.now() >= medida.hasta;
    },
    undefined,
    { timeout: 20_000 },
  );

  const medida = await page.evaluate(() => window.__clsConfiguracion);
  const detalle = (medida?.entradas ?? [])
    .map((e) => `  ${e.valor.toFixed(4)} a los ${e.en} ms: ${e.fuentes.join(" · ") || "sin fuentes"}`)
    .join("\n");
  expect(
    medida?.total ?? 0,
    `CLS de /configuracion (presupuesto 0,05). Desplazamientos:\n${detalle || "  (ninguno)"}`,
  ).toBeLessThan(0.05);

  // «Mis sesiones» sigue funcionando: la lista marca la sesión actual y el cierre de las demás pide confirmación
  const lista = page.getByRole("list", { name: "Sesiones abiertas" });
  await expect(lista).toBeVisible();
  await expect(lista.getByText("Esta sesión", { exact: true })).toBeVisible();
  const cerrar = page.getByRole("button", { name: "Cerrar las demás", exact: true });
  await expect(cerrar).toBeVisible();

  // Otra sesión de la misma cuenta abierta fuera de este navegador (este navegador ya entró con el fixture)
  const otra = await page.request.post("/api/auth/password", {
    data: { identifier: "pruebas", password: "pruebas-e2e-local" },
  });
  expect(otra.ok(), await otra.text()).toBe(true);
  await page.reload();
  await expect(lista.getByText("Esta sesión", { exact: true })).toBeVisible();
  await expect.poll(async () => lista.getByRole("listitem").count()).toBeGreaterThan(1);

  await expect(cerrar).toBeEnabled();
  await cerrar.click();
  await expect(page.getByRole("button", { name: "Sí, cerrar las demás", exact: true })).toBeVisible();
  // Se cancela: cerrar sesiones de verdad tiene su propia prueba y aquí no hace falta tocar las demás
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cerrar las demás", exact: true })).toBeVisible();
});
