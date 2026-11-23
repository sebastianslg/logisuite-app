import { expect, test } from "./helpers";

const SIN_SESION = { annotation: { type: "sin-sesion" } };

test("invitado: entra con un botón, ve el aviso y sus cambios no se guardan", SIN_SESION, async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Entrar como invitado" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("status").filter({ hasText: "Modo invitado" })).toBeVisible();

  // Un cambio: el servidor lo rechaza con el mensaje del modo invitado y nada se guarda
  const res = await page.evaluate(async () => {
    const token = localStorage.getItem("westvane.session_token");
    const r = await fetch("/api/settings/replenish", { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ enabled: false }) });
    return { status: r.status, body: await r.json() };
  });
  expect(res.status).toBe(403);
  expect(res.body.detail).toContain("Modo invitado");

  // «Salir» cierra la sesión y vuelve a la pantalla de ingreso
  await page.getByRole("status").filter({ hasText: "Modo invitado" }).getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/ingresar/);
});
