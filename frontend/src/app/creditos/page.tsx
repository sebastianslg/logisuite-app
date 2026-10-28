import Link from "next/link";

import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Créditos y licencias",
  description: "Fuentes de datos, cartografía, tipografía, íconos y software de terceros que usa Westvane, con sus licencias.",
};

type Item = { name: string; what: string; license: string; href: string };

const SECTIONS: { title: string; note?: string; items: Item[] }[] = [
  {
    title: "Cartografía y datos geográficos",
    items: [
      { name: "OpenStreetMap", what: "Datos del mapa base (vías, ríos, costas, nombres)", license: "© colaboradores de OpenStreetMap · ODbL 1.0", href: "https://www.openstreetmap.org/copyright" },
      { name: "OpenMapTiles", what: "Esquema de las teselas vectoriales del mapa base", license: "© OpenMapTiles · CC BY 4.0 (estilos BSD-3)", href: "https://openmaptiles.org/" },
      { name: "OpenFreeMap", what: "Servicio de teselas y estilos Positron y Dark", license: "Libre, sin clave, también para uso comercial", href: "https://openfreemap.org/" },
      { name: "Natural Earth", what: "Relieve sombreado del mapa base a escala de país", license: "Dominio público", href: "https://www.naturalearthdata.com/" },
      { name: "DANE · Marco Geoestadístico Nacional 2018", what: "Límites de departamentos (simplificados a 3 decimales)", license: "Fuente oficial; uso con cita de la fuente", href: "https://geoportal.dane.gov.co/" },
    ],
  },
  {
    title: "Datos económicos",
    items: [
      { name: "datos.gov.co · Superintendencia Financiera", what: "Tasa representativa del mercado (TRM) oficial, a pedido", license: "Datos abiertos del Gobierno de Colombia", href: "https://www.datos.gov.co/" },
    ],
  },
  {
    title: "Tipografía e íconos",
    note: "No se usan fotografías ni ilustraciones de terceros: el ícono de la app, la imagen para compartir y los diagramas son propios.",
    items: [
      { name: "Inter", what: "Tipografía de toda la interfaz, alojada en el propio sitio", license: "SIL Open Font License 1.1 · Rasmus Andersson", href: "https://rsms.me/inter/" },
      { name: "Noto Sans", what: "Letras de las etiquetas del mapa base", license: "SIL Open Font License 1.1 · Google", href: "https://fonts.google.com/noto" },
      { name: "Lucide", what: "Íconos", license: "ISC", href: "https://lucide.dev/license" },
    ],
  },
  {
    title: "Software de la interfaz",
    items: [
      { name: "Next.js", what: "Marco de la aplicación web", license: "MIT", href: "https://github.com/vercel/next.js" },
      { name: "React", what: "Interfaz", license: "MIT", href: "https://github.com/facebook/react" },
      { name: "deck.gl", what: "Capas 3D del mapa (rutas, flota, departamentos)", license: "MIT", href: "https://github.com/visgl/deck.gl" },
      { name: "MapLibre GL JS", what: "Motor del mapa base", license: "BSD-3-Clause", href: "https://github.com/maplibre/maplibre-gl-js" },
      { name: "react-map-gl", what: "Enlace entre React y el mapa", license: "MIT", href: "https://github.com/visgl/react-map-gl" },
      { name: "Motion (framer-motion)", what: "Animaciones", license: "MIT", href: "https://github.com/motiondivision/motion" },
      { name: "TanStack Table", what: "Tablas", license: "MIT", href: "https://github.com/TanStack/table" },
      { name: "Tailwind CSS", what: "Estilos", license: "MIT", href: "https://github.com/tailwindlabs/tailwindcss" },
      { name: "Radix UI, clsx, tailwind-merge, class-variance-authority", what: "Utilidades de componentes", license: "MIT · Apache-2.0", href: "https://www.radix-ui.com/" },
    ],
  },
  {
    title: "Software del servidor",
    items: [
      { name: "FastAPI", what: "API", license: "MIT", href: "https://github.com/fastapi/fastapi" },
      { name: "Uvicorn", what: "Servidor de la API", license: "BSD-3-Clause", href: "https://github.com/encode/uvicorn" },
      { name: "Pydantic", what: "Validación de datos", license: "MIT", href: "https://github.com/pydantic/pydantic" },
      { name: "pandas", what: "Cálculos de historial y reportes", license: "BSD-3-Clause", href: "https://github.com/pandas-dev/pandas" },
      { name: "NetworkX", what: "Motor de rutas sobre la red multimodal", license: "BSD-3-Clause", href: "https://github.com/networkx/networkx" },
      { name: "ReportLab", what: "Documentos PDF", license: "BSD", href: "https://www.reportlab.com/" },
      { name: "openpyxl", what: "Exportación e importación de Excel", license: "MIT", href: "https://foss.heptapod.net/openpyxl/openpyxl" },
      { name: "SQLite, Caddy", what: "Base de datos y servidor HTTPS", license: "Dominio público · Apache-2.0", href: "https://caddyserver.com/" },
    ],
  },
];

/** Créditos y licencias: lo que es de terceros, de dónde viene y bajo qué licencia se usa. */
export default function CreditosPage() {
  return (
    <div className="page page-narrow">
      <PageHeader
        title="Créditos y licencias"
        description="Fuentes de datos, cartografía, tipografía, íconos y software de terceros que usa Westvane, con sus licencias."
      />
      <div className="flex flex-col gap-10">
        <section className="rounded-2xl border border-border bg-card px-5 py-4 text-sm leading-relaxed">
          <h2 className="font-semibold">Datos de la operación</h2>
          <p className="mt-1 text-foreground/90">
            Los envíos, clientes, vehículos, bodegas, tarifas y la telemetría son <strong>simulados</strong>. Los nombres de empresas
            son ficticios: cualquier parecido con una empresa real es coincidencia. La red de vías, puertos, aeropuertos y ríos se
            basa en información pública y algunas trazas son aproximadas (ver{" "}
            <Link href="/metodologia#limites" className="text-primary underline">
              Metodología
            </Link>
            ).
          </p>
        </section>
        {SECTIONS.map((s) => (
          <section key={s.title} aria-labelledby={`c-${s.title}`}>
            <h2 id={`c-${s.title}`} className="text-[1.0625rem] font-semibold tracking-[-0.01em]">
              {s.title}
            </h2>
            {s.note && <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>}
            <ul className="rows mt-3 overflow-hidden rounded-2xl">
              {s.items.map((it) => (
                <li key={it.name} className="grid gap-x-6 gap-y-0.5 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <a href={it.href} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                      {it.name}
                    </a>
                    <div className="text-xs text-muted-foreground">{it.what}</div>
                  </div>
                  <div className="text-xs text-foreground/80 sm:text-right sm:text-[13px]">{it.license}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
