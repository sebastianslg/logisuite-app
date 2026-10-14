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

export async function apiGet<T>(path: string): Promise<T> {
  await connection();
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(`La API respondió ${res.status} en ${path}`, res.status);
  }
  return (await res.json()) as T;
}
