import type { MetadataRoute } from "next";

/** Lo que un buscador puede listar cuando se abre la indexación (ALLOW_INDEXING=1): la presentación y lo legal. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL ?? "https://westvane.duckdns.org";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/metodologia`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
