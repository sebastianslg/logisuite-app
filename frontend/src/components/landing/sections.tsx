import Link from "next/link";
import {
  ArrowRight,
  BookCheck,
  CalendarClock,
  ChartColumn,
  DatabaseBackup,
  FileDown,
  KeyRound,
  Leaf,
  Link2,
  Network,
  Package,
  PenLine,
  Receipt,
  ScrollText,
  ShieldCheck,
  TrafficCone,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Barra de la presentación: la marca, las anclas de la página y las dos salidas (la app y la demostración). */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background">
      <div className="mx-auto flex h-full max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-14 xl:px-20">
        <Link href="/" aria-label="Westvane, inicio" className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60">
          <Wordmark />
        </Link>
        <nav aria-label="Secciones de la presentación" className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          {[
            ["#red", "La red"],
            ["#ruta", "Calcular una ruta"],
            ["#modulos", "Módulos"],
            ["#seguridad", "Seguridad"],
            ["#preguntas", "Preguntas"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/panel"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:inline-flex"
          >
            Entrar a la app
          </Link>
          <Button asChild size="sm" className="h-9 px-4 text-sm">
            <a href="#demostracion">Pedir demostración</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Primer pantallazo, a la izquierda del mapa: qué es, para quién y las dos acciones. */
export function Intro({ nodes, links }: { nodes?: number; links?: number }) {
  return (
    <div className="max-w-[36rem]">
      <h1 className="text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-[3.25rem] xl:text-[3.875rem]">
        Su operación multimodal, sobre la red real de Colombia.
      </h1>
      <p className="mt-5 max-w-[34rem] text-[1.125rem] leading-relaxed text-muted-foreground sm:text-[1.1875rem]">
        Westvane planifica envíos por carretera, río, mar, aire y tren, sigue su flota y sus bodegas y redirige la carga cuando una vía
        se cierra. Un sistema completo para operadores logísticos.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg" className="h-12 px-6 text-base">
          <a href="#demostracion">Pedir demostración</a>
        </Button>
        <Button asChild variant="secondary" size="lg" className="h-12 px-6 text-base">
          <Link href="/panel">Ver la app en vivo</Link>
        </Button>
      </div>
      <p className="tabular mt-6 text-sm text-muted-foreground">
        {nodes && links ? `${nodes} nodos y ${links} enlaces reales. ` : ""}En la app, los envíos, clientes y vehículos son de ejemplo.
      </p>
    </div>
  );
}

const MODULES: { icon: LucideIcon; name: string; text: string; href: string }[] = [
  { icon: Package, name: "Envíos", text: "Crear uno o cientos desde Excel y seguir cada envío con su cadena de modos, su bitácora y sus documentos.", href: "/envios" },
  { icon: Network, name: "Red y rutas", text: "Rutas por tiempo, costo o huella sobre la red nacional, y alternativas comparadas antes de despachar.", href: "/red" },
  { icon: TrafficCone, name: "Vías y cierres", text: "Cierre vías, puertos o aeropuertos y vea qué envíos se redirigieron y cuáles quedaron sin ruta.", href: "/vias" },
  { icon: Truck, name: "Flota y conductores", text: "Vehículos, licencias, fallas y mantenimientos; un vehículo con documentos vencidos sale solo de la asignación.", href: "/flota" },
  { icon: Warehouse, name: "Bodegas", text: "Inventario por bodega, traslados entre ciudades y los vehículos que cada una aloja.", href: "/bodegas" },
  { icon: PenLine, name: "Prueba de entrega", text: "Firma y foto en el celular; una entrega con novedad avisa al administrador.", href: "/envios" },
  { icon: Link2, name: "Seguimiento para su cliente", text: "Un enlace por envío, sin datos internos, y aviso por correo cuando sale, se retrasa o llega.", href: "/envios" },
  { icon: CalendarClock, name: "Hoy y calendario", text: "Lo que sale, llega y vence hoy, y la semana de despachos en un calendario.", href: "/hoy" },
  { icon: Receipt, name: "Costos y cotizaciones", text: "Costo por tramo con peajes, transbordos e impuestos; cotización en PDF y costo real contra el estimado.", href: "/comparar" },
  { icon: Leaf, name: "Huella de carbono", text: "CO₂e y combustible por tramo y por modo, frente a mover todo por carretera.", href: "/huella" },
  { icon: ChartColumn, name: "Reportes", text: "Historial por ciudad, departamento y corredor; reporte operativo en PDF, semanal o mensual al correo.", href: "/historial" },
  { icon: ScrollText, name: "Auditoría", text: "Quién cambió qué y cuándo, con filtros y exportación a CSV.", href: "/auditoria" },
];

export function Modules() {
  return (
    <section id="modulos" aria-labelledby="modulos-titulo" className="scroll-mt-16 border-t border-border">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-8 lg:py-28">
        <div className="max-w-[46rem]">
          <h2 id="modulos-titulo" className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
            Un sistema completo, no una herramienta más.
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
            Lo que un operador mueve en un día vive en la misma base de datos, con el mismo historial y las mismas cifras en todas las
            pantallas. Cada módulo se puede abrir ahora con los datos de ejemplo.
          </p>
        </div>
        <ul className="mt-12 grid overflow-hidden rounded-3xl glass md:grid-cols-2">
          {MODULES.map(({ icon: Icon, name, text, href }, i) => (
            <li key={name} className={cn("border-border", i > 0 && "border-t", i === 1 && "md:border-t-0", i % 2 === 0 && "md:border-r")}>
              <Link href={href} className="row-link group h-full items-start gap-4 px-5 py-5 sm:px-7">
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold tracking-tight">{name}</span>
                  <span className="mt-1 block text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[var(--ease-apple)] group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const TRUST: { icon: LucideIcon; name: string; text: string }[] = [
  { icon: KeyRound, name: "Acceso sin contraseñas", text: "Se entra con un código de un solo uso que llega al correo: no hay contraseñas que robar ni reutilizar." },
  { icon: BookCheck, name: "Historial de cada cambio", text: "Cada creación, edición o borrado queda registrado con la cuenta que lo hizo y la hora." },
  { icon: DatabaseBackup, name: "Respaldo diario verificado", text: "Copia diaria de la base y de los documentos, con revisión de integridad y aviso si se atrasa." },
  { icon: FileDown, name: "Sus datos son suyos", text: "Envíos, flota, conductores, inventario y auditoría se exportan a Excel, CSV o PDF cuando quiera." },
  { icon: ShieldCheck, name: "Datos personales con cuidado", text: "Autorización registrada para firmas, fotos y correos de clientes, y plazos de conservación configurables." },
];

export function Trust() {
  return (
    <section id="seguridad" aria-labelledby="seguridad-titulo" className="scroll-mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-28">
        <div>
          <h2 id="seguridad-titulo" className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
            Control de la operación, de punta a punta.
          </h2>
          <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-muted-foreground">
            Un sistema que guarda la operación de su empresa tiene que dejar rastro de todo, no perder nada y no encerrar sus datos.
          </p>
        </div>
        <ul className="rule-list border-y border-border">
          {TRUST.map(({ icon: Icon, name, text }) => (
            <li key={name} className="flex gap-4 py-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold tracking-tight">{name}</span>
                <span className="mt-1 block text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "¿Hay que instalar algo?", a: "No. Funciona en el navegador, en Windows y en Android, y se puede instalar como aplicación desde el mismo navegador." },
  {
    q: "¿Puedo cargar mi flota, mis conductores y mi inventario?",
    a: "Sí, desde Excel o CSV. Antes de guardar, una vista previa muestra qué filas entran y por qué alguna no; nada se guarda hasta que usted confirma.",
  },
  {
    q: "¿Los datos de la app son reales?",
    a: "La red sí: nodos, vías, ríos, puertos y aeropuertos de Colombia, con lo aproximado marcado como tal. Los envíos, clientes y vehículos de la demostración son simulados.",
  },
  {
    q: "¿Cómo se calculan el costo y la huella?",
    a: (
      <>
        Por tramo: flete según el modo, peajes, manipulación en los transbordos e impuestos. La huella usa factores de emisión por modo: es una
        estimación, no un inventario certificado. El detalle está en la{" "}
        <Link href="/metodologia" className="font-medium text-primary underline-offset-2 hover:underline">
          metodología
        </Link>
        .
      </>
    ),
  },
  { q: "¿Funciona sin conexión?", a: "Las pantallas necesitan internet. Si se cae la red, la app lo avisa y no guarda nada a medias." },
  { q: "¿Cuánto cuesta?", a: "Depende del tamaño de su operación. Cuéntenos en el formulario y le preparamos una propuesta." },
];

export function Faq() {
  return (
    <section id="preguntas" aria-labelledby="preguntas-titulo" className="scroll-mt-16 border-t border-border">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-28">
        <h2 id="preguntas-titulo" className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
          Preguntas de quien lo evalúa.
        </h2>
        <div className="rule-list border-y border-border">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[1.0625rem] font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="relative size-4 shrink-0 text-muted-foreground">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-300 ease-[var(--ease-apple)] group-open:scale-y-0 motion-reduce:transition-none" />
                </span>
              </summary>
              <p className="max-w-[60ch] pb-5 text-[0.9375rem] leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DemoSection({ children }: { children: React.ReactNode }) {
  return (
    <section id="demostracion" aria-labelledby="demostracion-titulo" className="scroll-mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-28">
        <div>
          <h2 id="demostracion-titulo" className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
            Véalo con su propia operación.
          </h2>
          <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-muted-foreground">
            En una demostración recorremos sus rutas, su flota y sus bodegas en Westvane, y le mostramos cómo se cargan sus datos.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            ¿Prefiere mirar primero?{" "}
            <Link href="/panel" className="font-medium text-primary underline-offset-2 hover:underline">
              Entre a la app con los datos de ejemplo
            </Link>
            .
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[28rem]">
          <Wordmark />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sistema de gestión de transporte multimodal para Colombia. La red usa datos verificados y aproximados; en la app, los envíos,
            clientes y vehículos son de ejemplo.
          </p>
        </div>
        <nav aria-label="Enlaces del pie" className="grid grid-cols-2 gap-x-10 gap-y-1 text-sm sm:grid-cols-3">
          {[
            ["/panel", "Entrar a la app"],
            ["/metodologia", "Metodología"],
            ["/creditos", "Créditos"],
            ["/terminos", "Términos"],
            ["/privacidad", "Privacidad"],
            ["/cookies", "Cookies"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="py-2 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline pointer-coarse:min-h-11">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
