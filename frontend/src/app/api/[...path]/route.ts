import type { NextRequest } from "next/server";

/**
 * Proxy de /api/* hacia FastAPI para los Client Components.
 *
 * El navegador solo habla con el origen de Next.js (sin CORS ni puertos
 * expuestos) y la URL del backend se resuelve en tiempo de ejecución, así la
 * misma imagen sirve en local y en Docker.
 */
const base = () => process.env.API_INTERNAL_URL ?? "http://localhost:8000";

async function forward(req: NextRequest, path: string[]) {
  const url = `${base()}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
    cache: "no-store",
  };
  if (req.method === "POST") {
    init.body = await req.text();
  }
  try {
    const res = await fetch(url, init);
    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ detail: "No se pudo contactar la API" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  return forward(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  return forward(req, (await ctx.params).path);
}
