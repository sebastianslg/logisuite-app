import type { MetadataRoute } from "next";

/**
 * Sin ALLOW_INDEXING=1 no se indexa nada (ver también X-Robots-Tag en next.config.ts). Con él, solo lo público: la
 * presentación y los documentos legales. La app (/panel y sus secciones) y el seguimiento de clientes quedan fuera: son datos
 * de operación, no páginas para buscadores.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "1") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/metodologia", "/terminos", "/privacidad", "/cookies", "/creditos"],
      disallow: ["/"],
    },
    sitemap: `${process.env.SITE_URL ?? "https://westvane.duckdns.org"}/sitemap.xml`,
  };
}
