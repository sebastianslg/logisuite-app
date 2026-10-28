import { NextResponse, type NextRequest } from "next/server";

/**
 * Un envío, vehículo o bodega que no existe responde 404 de verdad.
 *
 * Las fichas cargan sus datos dentro de un límite de Suspense: cuando la API dice que el registro no existe,
 * la página ya empezó a transmitirse con estado 200 y `notFound()` solo puede cambiar lo que se ve. Aquí se
 * pregunta antes de renderizar y, si no existe, se muestra la página 404 con su estado. Si la API no responde
 * a tiempo, la petición sigue su camino normal (la ficha mostrará su propio error).
 */
const API = () => process.env.API_INTERNAL_URL ?? "http://localhost:8000";

function apiPath(pathname: string): string | null {
  const m = pathname.match(/^\/(envios|flota|bodegas)\/([^/]+)(?:\/editar)?\/?$/);
  if (!m) return null;
  const [, section, raw] = m;
  if (raw === "nuevo" || raw === "nueva") return null;
  const id = encodeURIComponent(decodeURIComponent(raw));
  if (section === "envios") return `/api/shipments/${id}`;
  if (!/^\d+$/.test(raw)) return "invalid";
  return section === "flota" ? `/api/fleet/vehicles/${id}` : `/api/warehouses/${id}`;
}

export async function proxy(request: NextRequest) {
  const path = apiPath(request.nextUrl.pathname);
  if (!path) return NextResponse.next();
  let missing = path === "invalid";
  if (!missing) {
    try {
      const res = await fetch(`${API()}${path}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(3000) });
      missing = res.status === 404;
    } catch {
      return NextResponse.next();
    }
  }
  if (!missing) return NextResponse.next();
  return NextResponse.rewrite(new URL("/no-encontrado", request.url), { status: 404 });
}

export const config = {
  matcher: ["/envios/:id", "/envios/:id/editar", "/flota/:id", "/flota/:id/editar", "/bodegas/:id", "/bodegas/:id/editar"],
};
