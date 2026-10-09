import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor autocontenido para la imagen Docker (Fase 6).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
