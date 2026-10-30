/**
 * Llamadas a la API desde Client Components (pasan por el proxy /api de Next).
 * Los errores de FastAPI ({detail}) se convierten en Error con ese mensaje.
 */
export async function api<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; headers?: Record<string, string> } = {},
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

  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      // Los PDF pueden tardar; nada debería tardar más de 60 s
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") throw new Error("La API tardó demasiado en responder");
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
  return (type.includes("application/json") ? res.json() : res.blob()) as Promise<T>;
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
