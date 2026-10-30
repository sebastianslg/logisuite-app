import { readFileSync } from "node:fs";

import { expect, test } from "./helpers";
import { PAGES } from "./helpers";

/**
 * Accesibilidad con axe-core (WCAG 2 A y AA) en todas las páginas, en tema claro y oscuro. Corre en escritorio y en
 * celular según el proyecto. Es la red de seguridad de la paleta: si un color nuevo deja un texto sin contraste, falla
 * aquí con el elemento y la razón. Las páginas que dibujan un mapa se revisan sin el lienzo (no es contenido de texto).
 */
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

for (const theme of ["light", "dark"] as const) {
  test(`axe: sin violaciones en todas las páginas (${theme})`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.addInitScript((t) => localStorage.setItem("westvane.theme", t), theme);
    const problems: string[] = [];
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: "load" });
      await page.waitForTimeout(1200);
      await page.evaluate(AXE);
      const result = await page.evaluate(async () => {
        // @ts-expect-error axe lo inyecta el script
        const r = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
          exclude: [["canvas"], [".maplibregl-map"], [".deck-tooltip"]],
        });
        return r.violations.map((v: { id: string; nodes: { target: string[]; failureSummary?: string }[] }) => ({
          id: v.id,
          nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} :: ${(n.failureSummary ?? "").split("\n")[1] ?? ""}`),
        }));
      });
      for (const v of result) problems.push(`${theme} ${path} · ${v.id}\n    ${v.nodes.join("\n    ")}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
