import type { MetadataRoute } from "next";

/** Permite instalar la app en Android (Chrome) y Windows (Edge/Chrome) como una aplicación independiente. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Westvane TMS",
    short_name: "Westvane",
    description: "Transportation Management System multimodal para la red logística de Colombia.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
