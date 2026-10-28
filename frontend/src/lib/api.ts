import "server-only";
import { connection } from "next/server";

/**
 * Lectura de la API desde Server Components.
 *
 * La URL interna (http://backend:8000 en Docker) se lee en tiempo de
 * ejecución: `connection()` evita que Next la congele durante el build.
 * Los componentes que la usan deben ir dentro de <Suspense>.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Tiempo máximo de una lectura: si la API no responde, la página muestra el error en vez de quedarse cargando. */
const TIMEOUT_MS = 12_000;

export async function apiGet<T>(path: string): Promise<T> {
  await connection();
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  const res = await fetch(`${base}${path}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new ApiError(`La API respondió ${res.status} en ${path}`, res.status);
  }
  return (await res.json()) as T;
}

/** Como apiGet, pero devuelve null si el recurso no existe (404). */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  await connection();
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  const res = await fetch(`${base}${path}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`La API respondió ${res.status} en ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * POST de solo cálculo desde Server Components (por ejemplo, simular una ruta). Devuelve `{ ok, data | error }`
 * en vez de lanzar: un escenario sin ruta es un resultado válido, no un fallo de la página.
 */
export async function apiPost<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  await connection();
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: typeof data.detail === "string" ? data.detail : `Error ${res.status}` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "La API no respondió" };
  }
}
