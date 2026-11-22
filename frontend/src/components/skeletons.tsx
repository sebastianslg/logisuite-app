import { NetworkRule } from "@/components/page-header";
import { cn } from "@/lib/utils";

/**
 * Piezas de las pantallas de carga (`loading.tsx`). Todas usan la clase `skeleton` del sistema: un brillo
 * que solo mueve `transform` y que se detiene por sí solo con «reducir movimiento» (ver `globals.css`).
 *
 * Son piezas de servidor: sin estado ni efectos. El dibujo queda oculto a lectores de pantalla y la
 * pantalla anuncia en español qué se está cargando (`LoadingScreen`).
 */

/** Una barra o bloque del esqueleto. El radio se ajusta con `rounded-*` desde quien la usa. */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

/** Envoltura de la pantalla de carga: anuncia lo que falta y deja el dibujo fuera del árbol accesible. */
export function LoadingScreen({
  label,
  className,
  children,
}: {
  /** Texto para lectores de pantalla, en español: «Cargando los envíos». */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Encabezado de página con la silueta de `PageHeader`: título, descripción, acciones y debajo la línea de red
 * ya dibujada (la misma firma visual, quieta).
 */
export function SkeletonPageHeader({
  actions = 1,
  description = true,
}: {
  /** Cuántos botones dibujar a la derecha. */
  actions?: number;
  description?: boolean;
}) {
  return (
    <div aria-hidden className="mb-8 md:mb-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {/* La fila del «Operación en vivo» (`LiveStamp`, 20 px de alto) y el `mt-2` del `h1`: sin ellos el bloque mide menos. */}
          <Bone className="h-5 w-36 rounded-full" />
          <Bone className="mt-2 h-9 w-56 rounded-lg md:h-10 md:w-72" />
          {description && (
            <div className="mt-3 flex flex-col gap-2">
              <Bone className="h-3.5 w-[min(100%,34rem)] rounded-full" />
              <Bone className="h-3.5 w-[min(60%,22rem)] rounded-full" />
            </div>
          )}
        </div>
        {actions > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {Array.from({ length: actions }, (_, i) => (
              <Bone key={i} className="h-9 w-28 rounded-md" />
            ))}
          </div>
        )}
      </div>
      {/* Mismo sitio y ritmo vertical que en `PageHeader`: justo bajo el bloque del título, con su propio margen. */}
      <NetworkRule still />
    </div>
  );
}

/** Encabezado de una ficha: vuelta a la lista, ícono, título con su estado, resumen y acciones. */
export function SkeletonDetailHeader({ actions = 3, icon = true }: { actions?: number; icon?: boolean }) {
  return (
    <div aria-hidden>
      <Bone className="h-3 w-16 rounded-full" />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <Bone className="mt-1 size-9 shrink-0 rounded-lg" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Bone className="h-8 w-32 rounded-lg md:w-40" />
              <Bone className="h-6 w-24 rounded-full" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Bone className="h-3.5 w-40 rounded-full" />
              <Bone className="h-3.5 w-20 rounded-full" />
            </div>
          </div>
        </div>
        {actions > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: actions }, (_, i) => (
              <Bone key={i} className={cn("h-8 rounded-md", i % 2 === 0 ? "w-28" : "w-24")} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Pestañas segmentadas de una página (flota, bodegas): una píldora de fondo con sus celdas. */
export function SkeletonTabs({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="inline-flex max-w-full gap-1 overflow-hidden rounded-full bg-fill p-1">
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className={cn("h-7 rounded-full", i === 0 ? "w-28" : "w-24")} />
      ))}
    </div>
  );
}

/** Franja de cifras (`StatStrip`): celdas separadas por líneas finas, sin tarjetas con ícono. */
export function SkeletonStatStrip({ cells = 4, className }: { cells?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("glass overflow-hidden rounded-3xl", className)}>
      {/* Cada celda dibuja su línea izquierda y superior, igual que `StatStrip` */}
      <div
        className={cn(
          "-mt-px -ml-px grid grid-cols-2",
          cells >= 3 && "md:grid-cols-3",
          cells === 4 && "xl:grid-cols-4",
          cells === 5 && "xl:grid-cols-5",
          cells >= 6 && "xl:grid-cols-6",
        )}
      >
        {Array.from({ length: cells }, (_, i) => (
          <div key={i} className="border-t border-l border-border bg-card px-5 py-4 md:px-6 md:py-5">
            <Bone className="h-3 w-24 rounded-full" />
            <Bone className="mt-3 h-6 w-16 rounded-[6px]" />
            <Bone className="mt-3 h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fila de filtros: buscador, chips y acciones, sobre una tabla o una lista. */
export function SkeletonFilters({
  chips = 7,
  actions = 2,
  className,
}: {
  chips?: number;
  actions?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("flex flex-wrap items-center gap-3", className)}>
      <Bone className="h-10 w-full max-w-xs rounded-lg" />
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: chips }, (_, i) => (
          <Bone key={i} className={cn("h-6 rounded-full", i % 3 === 0 ? "w-24" : "w-20")} />
        ))}
      </div>
      {actions > 0 && (
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Tabla dentro de una superficie (`glass`), con encabezado fijo y filas. */
export function SkeletonTable({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("glass overflow-hidden rounded-3xl", className)}>
      <div className="flex items-center gap-4 border-b border-border bg-card px-5 py-3">
        <Bone className="size-4 rounded-sm" />
        <Bone className="h-3 w-16 rounded-full" />
        <Bone className="h-3 flex-1 rounded-full" />
        <Bone className="hidden h-3 w-24 rounded-full md:block" />
        <Bone className="hidden h-3 w-20 rounded-full lg:block" />
        <Bone className="h-3 w-20 rounded-full" />
      </div>
      <div className="rule-list">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5">
            <Bone className="size-4 shrink-0 rounded-sm" />
            <Bone className="h-3.5 w-14 shrink-0 rounded-full" />
            <Bone className="h-3.5 flex-1 rounded-full" />
            <Bone className="hidden h-3.5 w-24 shrink-0 rounded-full md:block" />
            <Bone className="hidden h-3.5 w-16 shrink-0 rounded-full lg:block" />
            <Bone className="h-6 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista en filas dentro de una superficie: hora o código, dos líneas de texto y una etiqueta. */
export function SkeletonRows({
  rows = 6,
  header = false,
  className,
}: {
  rows?: number;
  /** Dibuja el encabezado de la sección (ícono, título y recuento), como las tarjetas de «Hoy». */
  header?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("glass overflow-hidden rounded-3xl", className)}>
      {header && (
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Bone className="size-4 rounded-sm" />
          <Bone className="h-4 w-24 rounded-full" />
          <Bone className="ml-auto h-3 w-6 rounded-full" />
        </div>
      )}
      <div className={cn("rule-list", header && "border-t border-border")}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-3 px-5 py-3.5">
            <Bone className="h-8 w-14 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Bone className="h-3.5 w-1/2 max-w-56 rounded-full" />
              <Bone className="h-3 w-2/3 max-w-72 rounded-full" />
            </div>
            <Bone className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tarjeta de contenido (`glass`): título y el relleno que se le pase. */
export function SkeletonCard({
  className,
  lines = 2,
  children,
}: {
  className?: string;
  /** Líneas de relleno cuando no se pasan hijos. */
  lines?: number;
  children?: React.ReactNode;
}) {
  return (
    <div aria-hidden className={cn("glass rounded-3xl p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Bone className="h-4 w-36 rounded-full" />
        <Bone className="h-4 w-14 rounded-full" />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {children ??
          Array.from({ length: lines }, (_, i) => (
            <Bone key={i} className={cn("h-3.5 rounded-full", i % 2 === 0 ? "w-full" : "w-2/3")} />
          ))}
      </div>
    </div>
  );
}

/** Sección de un formulario: cuántos campos lleva y en cuántas columnas van (2 si no se dice). */
export type FormSection = { fields: number; columns?: 1 | 2 | 3 };

/**
 * Formulario de alta o edición (`glass`): secciones de campos en rejilla, casillas o botones de opción
 * cuando la forma los tiene y la fila de botones al pie. Con `aside`, dibuja además el panel lateral
 * pegajoso (la vista previa de la ruta del formulario de envío).
 */
export function SkeletonForm({
  sections = [{ fields: 4 }],
  textarea = false,
  checks = 0,
  chips = 0,
  actions = 2,
  aside = false,
}: {
  /** Cada sección, en orden: cuántos campos y en cuántas columnas. */
  sections?: FormSection[];
  /** Campo de texto largo al final (notas, razón estratégica). */
  textarea?: boolean;
  /** Casillas de verificación en una fila, como «lo que puede manejar» de una bodega. */
  checks?: number;
  /** Botones de opción en una fila, como «forzar modos» de un envío. */
  chips?: number;
  /** Botones al pie; el primero es el de guardar. */
  actions?: number;
  /** Panel lateral con la vista previa (el formulario de envío lo tiene; los demás no). */
  aside?: boolean;
}) {
  /** El título de la sección ocupa todas las columnas de su rejilla. */
  const titleSpan = (columns: FormSection["columns"]) =>
    columns === 3 ? "sm:col-span-3" : columns === 1 ? undefined : "sm:col-span-2";

  return (
    <div aria-hidden className={cn("grid gap-6", aside && "lg:grid-cols-[minmax(0,1fr)_380px]")}>
      <div className={cn("glass flex flex-col gap-6 rounded-3xl p-5 md:p-6", !aside && "max-w-4xl")}>
        {sections.map((section, s) => {
          const columns = section.columns ?? 2;
          return (
            <div
              key={s}
              className={cn("grid gap-4", columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : undefined)}
            >
              <Bone className={cn("h-4 w-28 rounded-full", titleSpan(columns))} />
              {Array.from({ length: section.fields }, (_, f) => (
                <div key={f} className="flex flex-col gap-1.5">
                  <Bone className={cn("h-3 rounded-full", f % 3 === 0 ? "w-24" : f % 3 === 1 ? "w-16" : "w-20")} />
                  <Bone className="h-10 rounded-lg" />
                </div>
              ))}
            </div>
          );
        })}

        {chips > 0 && (
          <div className="flex flex-col gap-1.5">
            <Bone className="h-3 w-64 max-w-full rounded-full" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: chips }, (_, i) => (
                <Bone key={i} className={cn("h-8 rounded-md", i % 2 === 0 ? "w-28" : "w-24")} />
              ))}
            </div>
          </div>
        )}

        {checks > 0 && (
          <div className="flex flex-col gap-2">
            <Bone className="h-3 w-40 rounded-full" />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {Array.from({ length: checks }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Bone className="size-4 shrink-0 rounded-sm" />
                  <Bone className="h-3 w-24 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {textarea && (
          <div className="flex flex-col gap-1.5">
            <Bone className="h-3 w-24 rounded-full" />
            <Bone className="h-24 rounded-xl" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className={cn("h-9 rounded-md", i === 0 ? "w-36" : "w-28")} />
          ))}
          <Bone className="h-3 w-32 rounded-full" />
        </div>
      </div>

      {aside && <SkeletonCard className="h-fit" lines={4} />}
    </div>
  );
}
