import { Suspense } from "react";
import Link from "next/link";

import { PageHeader, Skeleton } from "@/components/page-header";
import { RouteGraphDiagram } from "@/components/method/route-graph-diagram";
import { apiGetOrNull } from "@/lib/api";
import { MODES } from "@/lib/modes";
import type { DashboardSummary, SustainabilitySummary } from "@/lib/types";

export const metadata = {
  title: "Metodología",
  description: "Cómo calcula Westvane las rutas multimodales, los costos, los tiempos, la huella de carbono y la redirección por cierres.",
};

const SECTIONS = [
  { id: "alcance", label: "Alcance y datos" },
  { id: "red", label: "La red" },
  { id: "ruta", label: "Cómo se elige la ruta" },
  { id: "costos", label: "Costos" },
  { id: "tiempos", label: "Tiempos, estado y retraso" },
  { id: "huella", label: "Combustible y CO₂e" },
  { id: "cierres", label: "Cierres y redirección" },
  { id: "operacion", label: "Operación simulada" },
  { id: "limites", label: "Supuestos y límites" },
  { id: "glosario", label: "Glosario" },
];

/**
 * Página de metodología: explica con el mismo vocabulario de la interfaz qué hace el motor y con qué supuestos.
 * Las cifras que viven en la base (factores de emisión, tamaño de la red) se leen de la API para no desactualizarse.
 */
export default function MetodologiaPage() {
  return (
    <div className="page">
      <PageHeader
        title="Metodología"
        description="Cómo calcula Westvane las rutas, los costos, los tiempos y la huella, qué supuestos usa y dónde están sus límites."
      />
      <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="En esta página" className="hidden lg:block print:hidden">
          <ol className="sticky top-24 flex flex-col gap-0.5 border-l border-border text-sm">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px flex gap-2 border-l border-transparent py-1 pl-4 text-muted-foreground hover:border-foreground hover:text-foreground">
                  <span className="tabular w-4 text-right text-xs leading-5 text-muted-foreground/80">{i + 1}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="method max-w-[72ch]">
          <Suspense fallback={<Skeleton className="h-[900px]" />}>
            <Body />
          </Suspense>
        </article>
      </div>
    </div>
  );
}

function H2({ id, n, children }: { id: string; n: number; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 scroll-mt-28 border-t border-border pt-8 text-[1.375rem] font-semibold tracking-[-0.02em] first:mt-0 first:border-0 first:pt-0">
      <span className="tabular mr-3 text-muted-foreground">{n}</span>
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[0.9375rem] leading-relaxed text-foreground/90">{children}</p>;
}

function Formula({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <figure className="mt-5 rounded-2xl border border-border bg-card px-5 py-4">
      <code className="block font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">{children}</code>
      {note && <figcaption className="mt-2 text-xs text-muted-foreground">{note}</figcaption>}
    </figure>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: React.ReactNode[][]; align?: ("left" | "right")[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${align?.[i] === "right" ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`tabular px-4 py-2.5 align-top ${align?.[j] === "right" ? "text-right" : ""} ${j === 0 ? "whitespace-nowrap" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Body() {
  const [green, summary] = await Promise.all([
    apiGetOrNull<SustainabilitySummary>("/api/sustainability/summary"),
    apiGetOrNull<DashboardSummary>("/api/dashboard/summary"),
  ]);
  const factors = green?.method.factors ?? [];
  const net = summary?.network;

  return (
    <>
      <H2 id="alcance" n={1}>
        Alcance y datos
      </H2>
      <P>
        Westvane es un sistema de gestión de transporte multimodal para Colombia: carretera, río, mar, aire y ferrocarril en una
        sola red. Calcula la mejor combinación de modos entre dos ciudades, sigue cada envío en el tiempo, estima su costo, su
        combustible y su huella, y recalcula las rutas cuando se cierra una vía o un nodo.
      </P>
      <P>
        <strong>Los datos de operación son simulados</strong>: clientes, transportistas, flota y telemetría son ficticios. La red
        mezcla tramos verificados con tramos aproximados; los aproximados se marcan como tales en la interfaz y nunca se inventan
        vías ni municipios sin trazado real.
      </P>

      <H2 id="red" n={2}>
        La red
      </H2>
      <P>
        La red tiene {net ? <strong className="tabular">{net.nodes} nodos</strong> : "nodos"} (ciudades, centros de distribución,
        puertos marítimos y fluviales, aeropuertos y terminales férreas) y {net ? <strong className="tabular">{net.links} enlaces</strong> : "enlaces"}.
        Cada enlace pertenece a un corredor con nombre (por ejemplo, Ruta del Sol o Río Magdalena) y tiene distancia, velocidad,
        costo fijo por despacho, costo por tonelada-kilómetro, capacidad por despacho y, en carretera, peajes.
      </P>
      {net && (
        <Table
          head={["Modo", "Enlaces", "Longitud"]}
          align={["left", "right", "right"]}
          rows={net.modes.map((m) => [MODES[m.mode]?.label ?? m.label, m.links.toLocaleString("es-CO"), m.km_fmt])}
        />
      )}

      <H2 id="ruta" n={3}>
        Cómo se elige la ruta
      </H2>
      <P>
        El motor usa un <strong>grafo expandido por estados</strong>: cada nodo físico se repite una vez por cada modo que opera en
        él. Un enlace de transporte une estados del mismo modo; un <strong>transbordo</strong> es una arista entre dos modos del
        mismo nodo, con el tiempo y el costo de manipulación de ese tipo de nodo. Así, el algoritmo de Dijkstra encuentra la ruta
        óptima y, por construcción, cuenta y costea cada cambio de modo.
      </P>
      <RouteGraphDiagram />
      <P>
        En el aire la carga no atraviesa un aeropuerto en el mismo avión: cada aeropuerto tiene un estado de llegada y uno de
        salida, unidos por una conexión que cuesta el 60 % de un transbordo del aeropuerto. Una escala Leticia → Bogotá →
        Cartagena cuenta como transbordo.
      </P>
      <Table
        head={["Prioridad", "Qué minimiza"]}
        rows={[
          ["Tiempo", "Horas totales: tránsito más transbordos."],
          ["Costo", "Dólares: costos fijos, toneladas-kilómetro, peajes, impuestos y transbordos."],
          ["Balanceado", "Costo generalizado: dólares más el valor del tiempo de la carga (12 USD por tonelada y hora)."],
        ]}
      />
      <P>
        Restricciones: un enlace cuya capacidad por despacho es menor que el peso del envío se excluye (30 t no salen de Leticia en
        un carguero de 20 t). Al crear un envío se pueden <strong>forzar modos</strong> (la ruta solo usa esos) o{" "}
        <strong>forzar hasta tres vías</strong> (la ruta pasa por cada una; se resuelve con un grafo por capas).
      </P>

      <H2 id="costos" n={4}>
        Costos
      </H2>
      <P>Los costos se calculan en dólares (moneda base) y se muestran en pesos con la TRM vigente cuando se elige COP.</P>
      <Formula note="Por cada tramo de la ruta, con el peso del envío en toneladas.">
        {`flete del tramo = costo fijo + costo por t-km × distancia (km) × peso (t)
peajes          = peaje por despacho del tramo (COP) ÷ TRM
impuestos       = (IVA + ICA) × flete del tramo
transbordo      = costo de manipulación por t del nodo × peso (t)   (+ impuestos)
costo total     = Σ tramos + Σ transbordos`}
      </Formula>
      <P>
        El IVA parte en 19 % y el ICA en 0 %, ambos editables y pendientes de confirmar con un contador. Los peajes se cargan por
        tramo en <Link href="/configuracion" className="text-primary hover:underline">Configuración</Link>; mientras no haya tarifa,
        el tramo suma cero.
      </P>

      <H2 id="tiempos" n={5}>
        Tiempos, estado y retraso
      </H2>
      <P>
        La ruta tiene una duración planeada (tránsito más transbordos) y la <strong>ETA planeada</strong> es la salida más esa
        duración. El estado de un envío en cualquier instante se deduce de su salida, su duración y su retraso:
      </P>
      <Table
        head={["Estado", "Cuándo"]}
        rows={[
          ["Programado", "Aún no sale."],
          ["En ruta", "Salió y no ha llegado."],
          ["Transferencia modal", "Está dentro del tiempo de un transbordo."],
          ["Retrasado", "Tiene retraso y ya pasó la ETA planeada."],
          ["Entregado", "Pasó la duración planeada más el retraso."],
        ]}
      />
      <P>
        El <strong>retraso estira el recorrido</strong>: la carga avanza más lento de lo planeado en proporción, así el avance y la
        posición en el mapa siguen siendo coherentes. Una incidencia registrada en la bitácora del envío puede sumar horas de
        retraso; se aplica como una edición más y queda en el historial.
      </P>

      <H2 id="huella" n={6}>
        Combustible y CO₂e
      </H2>
      <Formula note="Factores pozo a rueda, orden de magnitud del marco GLEC. El combustible se deriva de las mismas emisiones, así ambas cifras son coherentes.">
        {`CO₂e (kg)        = t-km × intensidad del modo (g CO₂e por t-km) ÷ 1000
combustible (L)  = CO₂e (kg) ÷ kg CO₂e por litro del combustible
frente a carretera = mismas t-km por camión, para comparar`}
      </Formula>
      {factors.length > 0 && (
        <Table
          head={["Modo", "Intensidad (g CO₂e/t-km)", "Combustible"]}
          align={["left", "right", "left"]}
          rows={factors.map((f) => [MODES[f.mode].label, f.g_co2e_per_tkm.toLocaleString("es-CO"), f.fuel])}
        />
      )}
      <P>Es una estimación para comparar modos y escenarios, no un inventario certificado.</P>

      <H2 id="cierres" n={7}>
        Cierres y redirección
      </H2>
      <P>
        Una vía o un nodo cerrado sigue en el mapa, pero sus enlaces salen del grafo de ruteo. Al cerrarlo, cada envío afectado se
        recalcula desde un <strong>pivote</strong>: el inicio del primer tramo pendiente que usa lo cerrado.
      </P>
      <Table
        head={["Situación del envío", "Qué se hace"]}
        rows={[
          ["Programado", "Se recalcula la ruta completa."],
          ["Aún no llega al pivote", "Se conserva la ruta hasta el pivote y desde ahí se busca una nueva."],
          ["Está en el tramo afectado", "Se conserva lo recorrido, se añade el regreso al pivote y desde ahí se busca una nueva."],
          ["Sin alternativa", "Queda marcado «sin ruta» con su ruta anterior como referencia."],
        ]}
      />
      <P>Al reabrir, los envíos sin ruta que ya no usan cierres vuelven a la normalidad y los programados se recalculan desde cero.</P>

      <H2 id="operacion" n={8}>
        Operación simulada
      </H2>
      <P>
        Para que la operación no se vacíe con los días, la <strong>reposición automática</strong> despacha envíos nuevos cuando hay
        menos de 16 en tránsito (se puede apagar en Configuración). La posición de cada vehículo se interpola sobre el trazado de su
        tramo según la hora; los estados se ponen al día como máximo cada 15 segundos.
      </P>
      <P>
        Las tendencias del resumen se reconstruyen con los datos actuales de cada envío (salida, duración y retraso): si a un envío se
        le sumó retraso después, el pasado se ve con ese retraso.
      </P>

      <H2 id="limites" n={9}>
        Supuestos y límites
      </H2>
      <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[0.9375rem] leading-relaxed text-foreground/90 marker:text-muted-foreground">
        <li>Coordenadas y distancias de la red ampliada son aproximadas; deben contrastarse con INVÍAS, ANI y Cormagdalena.</li>
        <li>El estado de algunas líneas férreas (Pacífico, Bogotá–Belencito) está por verificar con la ANI.</li>
        <li>Capacidades de aeropuertos regionales y de los ríos Meta, Orinoco y Atrato son supuestos de modelado.</li>
        <li>Impuestos y peajes son provisionales hasta cargar tarifas oficiales.</li>
        <li>No hay usuarios con contraseña: quien firma cada cambio es el nombre declarado en el menú «Más».</li>
      </ul>

      <H2 id="glosario" n={10}>
        Glosario
      </H2>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-[0.9375rem] sm:grid-cols-[10rem_minmax(0,1fr)]">
        {[
          ["t-km", "Tonelada-kilómetro: una tonelada movida un kilómetro. Mide el trabajo de transporte."],
          ["Transbordo", "Cambio de modo (o de avión) en un nodo, con tiempo y costo de manipulación."],
          ["ETA", "Hora estimada de llegada. La planeada no incluye el retraso; el retraso se muestra aparte."],
          ["OTIF", "Entregas a tiempo sobre entregas totales (aquí, sin retraso registrado)."],
          ["TRM", "Tasa representativa del mercado: pesos por dólar, certificada por el Banco de la República."],
          ["Corredor", "Vía con nombre a la que pertenecen uno o varios enlaces; se cierra y se reabre como unidad."],
        ].map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium">{k}</dt>
            <dd className="text-foreground/90">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
