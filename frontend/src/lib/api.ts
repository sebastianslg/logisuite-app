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
