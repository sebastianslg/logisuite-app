import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { LoadingScreen, SkeletonCard } from "@/components/skeletons";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { TollsPanel } from "@/components/settings/tolls-panel";
import { apiGet } from "@/lib/api";
import type { AuditEntry, Settings, ShareLink, Toll } from "@/lib/types";

export const metadata = { title: "Configuración" };

export default function ConfiguracionPage() {
  return (
    <div className="page">
      <PageHeader
        title="Configuración"
        description="Tasa de cambio, reposición automática de envíos simulados, enlaces compartidos e historial de cambios."
      />
      {/*
        El contenedor reserva al menos una pantalla de alto: mientras el panel llega, o si el límite de Suspense se
        quedara vacío un instante, el pie de página no sube al pliegue y nada de lo visible se mueve. El panel real
        mide más de dos pantallas, así que no deja hueco al terminar.
      */}
      <div className="min-h-[100svh]">
        <Suspense fallback={<EsqueletoPanel />}>
          <Panel />
        </Suspense>
      </div>
    </div>
  );
}

async function Panel() {
  const [settings, links, audit, tolls] = await Promise.all([
    apiGet<Settings>("/api/settings"),
    apiGet<{ items: ShareLink[] }>("/api/exports"),
    apiGet<{ items: AuditEntry[] }>("/api/audit?limit=300"),
    apiGet<{ items: Toll[] }>("/api/tolls"),
  ]);
  return (
    <>
      <SettingsPanel settings={settings} links={links.items} history={audit.items} />
      <TollsPanel tolls={tolls.items} />
    </>
  );
}

/**
 * Tarjetas del esqueleto, en el mismo orden que las secciones de `SettingsPanel` y con el alto medido de cada una
 * (con el CSS real, a 1400 px de ancho y en un celular de 390): el comentario dice cuál es. Cada entrada es una
 * clase completa, literal, para que Tailwind la genere; `lineas` rellena la tarjeta para que la silueta no quede
 * hueca. Los altos son el mínimo que evita el salto; una sección que crezca con los datos (los avisos por correo o
 * el estado del servidor de un administrador) mueve solo lo que está por debajo del pliegue.
 */
const SECCIONES: { alto: string; lineas: number }[] = [
  { alto: "h-[31rem] sm:h-[21rem]", lineas: 6 }, // Tasa de cambio (TRM): descripción y formulario de tres campos
  { alto: "h-[11rem] sm:h-[9.25rem]", lineas: 3 }, // Reposición automática: descripción y el interruptor
  { alto: "h-[11rem] sm:h-[9.5rem]", lineas: 3 }, // Avisos por correo: descripción y la lista de avisos
  { alto: "h-[10rem] sm:h-[8.75rem]", lineas: 2 }, // Estado del servidor: el aviso para quien no es administrador
  { alto: "h-[27rem] sm:h-[16.25rem]", lineas: 4 }, // Mi contraseña: tres campos y la nota al pie
  { alto: "h-[18.5rem] sm:h-[15rem]", lineas: 4 }, // Mis sesiones: descripción, filas y el cierre de las demás
  { alto: "h-[21rem] sm:h-[15.5rem]", lineas: 4 }, // Mapa en este navegador: calidad, casilla y el detalle
  { alto: "h-[14.5rem] sm:h-[10rem]", lineas: 3 }, // Ayuda: descripción y el botón de atajos
  { alto: "h-[32.5rem] sm:h-[20.25rem]", lineas: 6 }, // Privacidad y aceptaciones: tres documentos y sus botones
  { alto: "h-[16.5rem] sm:h-[10.5rem]", lineas: 2 }, // Errores recientes del navegador
  { alto: "h-[11.5rem] sm:h-[8rem]", lineas: 2 }, // Enlaces compartidos
];

/**
 * Esqueleto de Configuración con la forma real del panel: dos columnas (las secciones a la izquierda y el historial
 * de cambios a la derecha) y, debajo, los peajes por tramo. Antes era un bloque de 640 px que después se cambiaba
 * por más de 4.000: al llegar el contenido todo lo que estaba más abajo se movía y la página medía 0,092 de CLS.
 * Con la silueta y el alto ya en su sitio, el panel entra sin que nada salte (y «reducir movimiento» lo deja
 * quieto, como el resto de esqueletos).
 */
function EsqueletoPanel() {
  return (
    <LoadingScreen label="Cargando la configuración">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          {SECCIONES.map((s, i) => (
            <SkeletonCard key={i} className={s.alto} lines={s.lineas} />
          ))}
        </div>
        {/* Historial de cambios: la columna de la derecha, con su lista larga y acotada */}
        <SkeletonCard className="h-[56rem]" lines={4} />
      </div>
      {/* Peajes por tramo terrestre: la superficie ancha de abajo */}
      <SkeletonCard className="mt-6 h-[46rem]" lines={3} />
    </LoadingScreen>
  );
}
