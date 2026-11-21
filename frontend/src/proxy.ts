import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de las páginas de la app, con dos trabajos:
 *
 * 1. **Pedir sesión.** Las páginas de la app (no la presentación en /, el seguimiento para clientes, lo legal ni la propia
 *    pantalla de ingreso) exigen una sesión válida: el token viaja en la cookie `westvane_session` (la escribe
 *    `lib/auth.ts` al ingresar) y se comprueba contra `/api/auth/me`. Sin sesión, o vencida, lleva a `/ingresar` con la
 *    página pedida en `next`. Cada token válido se recuerda un minuto para no consultar la API en cada navegación. Si la
 *    API no responde se deja pasar: la página mostrará su propio error en vez de un ingreso que tampoco funcionaría.
 *
 * 2. Un envío, vehículo o bodega que no existe responde 404 de verdad.
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

const SESSION_COOKIE = "westvane_session";
const SESSION_MEMO_MS = 60_000;
const valid = new Map<string, number>();

/** true con sesión válida, false sin ella, null si la API no respondió. */
async function sessionOk(token: string | undefined): Promise<boolean | null> {
  if (!token) return false;
  const until = valid.get(token);
  if (until && until > Date.now()) return true;
  try {
    const res = await fetch(`${API()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 401) {
      valid.delete(token);
      return false;
    }
    if (!res.ok) return null;
    if (valid.size > 500) valid.clear();
    valid.set(token, Date.now() + SESSION_MEMO_MS);
    return true;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const ok = await sessionOk(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok === false) {
    const url = new URL("/ingresar", request.url);
    url.search = "";
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const res = NextResponse.redirect(url);
    if (request.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE); // vencida: no se vuelve a consultar
    return res;
  }
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

// Páginas de la app (cada sección con todo lo que cuelga de ella). Fuera quedan /, /seguimiento, /ingresar, lo legal,
// /metodologia, /creditos, la API y los archivos estáticos.
export const config = {
  matcher: [
    "/panel/:path*",
    "/hoy/:path*",
    "/envios/:path*",
    "/flota/:path*",
    "/bodegas/:path*",
    "/red/:path*",
    "/vias/:path*",
    "/clientes/:path*",
    "/calendario/:path*",
    "/cotizacion/:path*",
    "/comparar/:path*",
    "/combustible/:path*",
    "/huella/:path*",
    "/historial/:path*",
    "/auditoria/:path*",
    "/configuracion/:path*",
    "/administracion/:path*",
  ],
};
