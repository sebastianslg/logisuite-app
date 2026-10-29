import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de navegador (Playwright). Recorren la app como una persona: navegación, envíos, exportaciones,
 * avisos, historial y celular.
 *
 *   npm run build && npm run test:e2e
 *
 * Levantan la API (con una base temporal, nunca la de backend/data) y el frontend compilado, salvo que ya
 * estén corriendo (E2E_BASE_URL apunta a otro servidor).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const DB = process.env.E2E_DB_PATH ?? `${process.env.RUNNER_TEMP ?? "/tmp"}/westvane-e2e.db`;
const PYTHON = process.platform === "win32" ? ".\\.venv\\Scripts\\python.exe" : "python";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } }, testIgnore: /celular\.spec\.ts/ },
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /celular\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `${PYTHON} -m uvicorn app.main:app --port ${API_PORT}`,
          cwd: "../backend",
          // Misma zona horaria que producción (docker-compose: TZ=America/Bogota) y que el navegador de las pruebas
          env: { WESTVANE_DB_PATH: DB, WESTVANE_CACHE_TTL: "0", TZ: "America/Bogota" },
          url: `http://127.0.0.1:${API_PORT}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: `npx next start -p ${PORT}`,
          env: { API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, TZ: "America/Bogota" },
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
