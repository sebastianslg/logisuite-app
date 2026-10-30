import type { NextRequest } from "next/server";

/**
 * Proxy de /api/* hacia FastAPI para los Client Components.
 *
 * El navegador solo habla con el origen de Next.js (sin CORS ni puertos
 * expuestos) y la URL del backend se resuelve en tiempo de ejecución, así la
 * misma imagen sirve en local y en Docker.
 */
const base = () => process.env.API_INTERNAL_URL ?? "http://localhost:8000";
/** Una petición colgada no debe retener la conexión: se corta a los 30 s (o si el navegador se va antes). */
const TIMEOUT_MS = 30_000;

async function forward(req: NextRequest, path: string[]) {
  const url = `${base()}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
      ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
      // La IP del cliente (la que puso Caddy) para el límite de escrituras de la API
      ...(req.headers.get("x-forwarded-for") ? { "x-forwarded-for": req.headers.get("x-forwarded-for")! } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(TIMEOUT_MS)]),
  };
  if (req.method === "POST" || req.method === "PUT") {
    init.body = await req.text();
  }
  try {
    const res = await fetch(url, init);
    const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "application/json" });
    // PDF: inline (ver en el navegador) o attachment (descargar)
    const disposition = res.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return Response.json({ detail: "La API tardó demasiado en responder" }, { status: 504 });
    }
    return Response.json({ detail: "No se pudo contactar la API" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  return forward(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  return forward(req, (await ctx.params).path);
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  return forward(req, (await ctx.params).path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  return forward(req, (await ctx.params).path);
}
