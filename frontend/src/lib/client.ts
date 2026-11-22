/**
 * Llamadas a la API desde Client Components (pasan por el proxy /api de Next).
 * Los errores de FastAPI ({detail}) se convierten en Error con ese mensaje.
 */
import { senalConPlazo } from "./abort";
import { lecturaDeRuta } from "./lecturas-ruta";

export async function api<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
    /** Caché del navegador: `no-store` (por defecto) o `no-cache` (guardar y revalidar con ETag). */
    cache?: RequestCache;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let res: Response;
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (typeof window !== "undefined") {
    try {
      const token = window.localStorage.getItem("westvane.session_token");
      if (token && !headers["Authorization"] && !headers["authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      /* localStorage inaccesible */
    }
  }

  const lecturaLocal = typeof window !== "undefined" && (!options.method || options.method === "GET")
    && !path.startsWith("/api/auth/") && path !== "/api/settings";
  const vigencia = options.signal ?? (lecturaLocal ? lecturaDeRuta() : undefined);
  // Los PDF pueden tardar; nada debería tardar más de 60 s. El plazo se combina a mano porque Safari viejo no
  // tiene AbortSignal.any ni AbortSignal.timeout.
  const plazo = senalConPlazo(vigencia, 60_000);
  try {
    try {
      res = await fetch(path, {
        method: options.method ?? "GET",
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        cache: options.cache ?? "no-store",
        signal: plazo.signal,
      });
    } catch (e) {
      if (vigencia?.aborted) throw e;
      if (plazo.vencido()) throw new Error("La API tardó demasiado. Comprueba la conexión y vuelve a intentarlo.");
      throw new Error("No se pudo contactar la API");
    }
    if (!res.ok) {
      let detail = `Error ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data.detail === "string") detail = data.detail;
        else if (Array.isArray(data.detail)) detail = data.detail.map((d: { msg: string }) => d.msg).join("; ");
      } catch {
        /* respuesta sin JSON */
      }
      throw new Error(detail);
    }
    const type = res.headers.get("content-type") ?? "";
    try {
      return (type.includes("application/json") ? await res.json() : await res.blob()) as T;
    } catch (e) {
      if (plazo.vencido()) throw new Error("La API tardó demasiado. Comprueba la conexión y vuelve a intentarlo.");
      throw e;
    }
  } finally {
    plazo.liberar();
  }
}

/** Descarga un Blob con el nombre indicado. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre un Blob (PDF) en una pestaña nueva. */
export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
