"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Activity, Copy, X } from "lucide-react";

import { glRenderer, lowEndDevice, useMapQuality } from "@/components/map/use-map-animation";
import { toast } from "@/components/ui/toast";

const KEY = "westvane:diagnostico";
const EVENT = "westvane:diagnostico";

function enabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
function setEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event(EVENT));
}

type Block = { at: string; path: string; ms: number };

/**
 * Diagnóstico de rendimiento en el equipo de quien usa la app: se abre con `?diagnostico` en cualquier URL y
 * queda activo en este navegador hasta cerrarlo. Mide cuadros por segundo y los bloqueos del hilo principal
 * (tareas de más de 50 ms) con la página en que ocurrieron, y arma un informe para copiar y enviar. Apagado no
 * corre nada: el contador de cuadros solo existe mientras el panel está abierto.
 */
export function Diagnostics() {
  const on = useSyncExternalStore(subscribe, enabled, () => false);
  const pathname = usePathname();

  // `?diagnostico` en la URL lo enciende (y queda guardado); no cambia estado de React, solo el almacenamiento
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("diagnostico")) setEnabled(true);
  }, [pathname]);

  if (!on) return null;
  return <Panel pathname={pathname} />;
}

function Panel({ pathname }: { pathname: string }) {
  const { quality, lite } = useMapQuality();
  const [fps, setFps] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Bloqueos del hilo principal
  useEffect(() => {
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((list) => {
        const fresh = list.getEntries().map((e) => ({ at: new Date().toLocaleTimeString("es-CO"), path: pathRef.current, ms: Math.round(e.duration) }));
        setBlocks((b) => [...b, ...fresh].slice(-200));
      });
      po.observe({ type: "longtask", buffered: true });
    } catch {
      /* el navegador no informa tareas largas (Safari, Firefox): solo se mide FPS */
    }
    return () => po?.disconnect();
  }, []);

  // Cuadros por segundo, muestreados cada segundo (solo mientras el panel está abierto)
  useEffect(() => {
    let frames = 0;
    let raf = 0;
    const loop = () => {
      frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const t = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, []);

  const worst = blocks.reduce((m, b) => Math.max(m, b.ms), 0);
  const heavy = blocks.filter((b) => b.ms >= 250).length;

  async function copy() {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const report = {
      fecha: new Date().toISOString(),
      pagina: pathname,
      navegador: navigator.userAgent,
      tarjeta_grafica: glRenderer() || "no informada",
      equipo_modesto: lowEndDevice(),
      nucleos: navigator.hardwareConcurrency,
      memoria_gb: nav.deviceMemory ?? "no informada",
      pantalla: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
      calidad_mapa: `${quality} (${lite ? "liviana" : "alta"})`,
      fps_actual: fps,
      bloqueos: { total: blocks.length, de_250ms_o_mas: heavy, peor_ms: worst, ultimos: blocks.slice(-60) },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast({ title: "Informe copiado", description: "Pégalo en el chat o en un correo." });
    } catch {
      toast({ title: "No se pudo copiar", description: "El navegador no dio acceso al portapapeles.", tone: "error" });
    }
  }

  return (
    <section
      aria-label="Diagnóstico de rendimiento"
      className="floating fixed bottom-28 left-3 z-[70] w-64 rounded-2xl p-3 text-xs md:bottom-4 print:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <Activity className="size-3.5 text-primary" aria-hidden /> Diagnóstico
        </span>
        <button
          type="button"
          onClick={() => setEnabled(false)}
          aria-label="Cerrar el diagnóstico"
          className="press flex size-7 items-center justify-center rounded-full hover:bg-fill"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <dl className="tabular mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Cuadros/s</dt>
        <dd className={fps && fps < 30 ? "text-destructive" : ""}>{fps}</dd>
        <dt className="text-muted-foreground">Bloqueos</dt>
        <dd>{blocks.length}</dd>
        <dt className="text-muted-foreground">De 250 ms o más</dt>
        <dd className={heavy ? "text-destructive" : ""}>{heavy}</dd>
        <dt className="text-muted-foreground">El peor</dt>
        <dd className={worst >= 250 ? "text-destructive" : ""}>{worst} ms</dd>
        <dt className="text-muted-foreground">Mapa</dt>
        <dd>{lite ? "liviano" : "alta"}</dd>
      </dl>
      <button
        type="button"
        onClick={copy}
        className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-fill py-2 font-medium hover:bg-fill/70"
      >
        <Copy className="size-3.5" aria-hidden /> Copiar informe
      </button>
    </section>
  );
}
