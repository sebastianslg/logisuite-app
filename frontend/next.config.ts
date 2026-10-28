import type { NextConfig } from "next";

/**
 * Política de contenido: solo se ejecuta y se carga lo de este sitio, más el mapa base de OpenFreeMap (estilo,
 * teselas, letras y sprites). 'unsafe-inline' en scripts lo exige el arranque de Next sin nonces y el script que
 * fija el tema antes de pintar; sigue bloqueando scripts de cualquier otro dominio. El mapa usa trabajadores
 * desde /vendor y blob:. Nada puede meter la app en un marco (frame-ancestors).
 */
const MAP_HOSTS = "https://tiles.openfreemap.org";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MAP_HOSTS}`,
  "font-src 'self' data:",
  `connect-src 'self' ${MAP_HOSTS}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // La app no se indexa en buscadores mientras sea privada (ALLOW_INDEXING=1 al lanzarla al público)
  ...(process.env.ALLOW_INDEXING === "1" ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  // Servidor autocontenido para la imagen Docker (Fase 6).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Sin "X-Powered-By: Next.js": no anunciar la tecnología a quien busca versiones vulnerables
  poweredByHeader: false,
  async headers() {
    return [
      // Páginas: todas las cabeceras. /api (adjuntos y PDF que se abren en el visor del navegador) sin la
      // política de contenido, que bloquearía el visor de PDF; las demás protecciones sí aplican.
      { source: "/((?!api/).*)", headers: SECURITY_HEADERS },
      { source: "/api/:path*", headers: SECURITY_HEADERS.filter((h) => h.key !== "Content-Security-Policy") },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
