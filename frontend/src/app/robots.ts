import type { MetadataRoute } from "next";

/** Mientras la app sea privada no se indexa (ver también X-Robots-Tag en next.config.ts). */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING === "1") return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
  return { rules: { userAgent: "*", disallow: "/" } };
}
