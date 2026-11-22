"use client";

import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import type { Map3DProps } from "@/components/Map3D";
import { NetworkPreview } from "@/components/map/network-preview";
import { Button } from "@/components/ui/button";
import { onQuiet } from "@/lib/idle";

/**
 * El mapa se crea cuando su contenedor está en pantalla (o a 200 px), la página ya cargó, la pestaña está visible y
 * el navegador lleva un rato sin entradas: crear el contexto WebGL y compilar sombreadores es lo más caro de la app y
 * cae entero en una sola tarea, así que no puede empezar encima de un toque, de la paleta Ctrl K o de un diálogo
 * abierto. Mientras espera —y mientras baja el trozo de deck.gl/MapLibre— se ve la red dibujada en plano.
 *
 * Fuera de pantalla o con la pestaña oculta el mapa se pausa (Map3D detiene su reloj y su requestAnimationFrame), pero
 * no se desmonta: recrear el contexto WebGL cuesta segundos en equipos sin GPU. Si el trozo no llega, el navegador no
 * puede dibujar WebGL o el mapa falla en tiempo de ejecución, queda la red plana con un reintento explícito; nunca una
 * pantalla vacía ni un reintento silencioso en cada render.
 */
type Failure = "webgl" | "import" | "runtime";

const FAILURE_TEXT: Record<Failure, string> = {
  webgl: "Este equipo no puede dibujar el mapa 3D. Se muestra la red en plano.",
  import: "No se pudo cargar la cartografía 3D. Se muestra la red en plano.",
  runtime: "El mapa 3D se detuvo. Se muestra la red en plano.",
};

/** Comprobación barata (una vez por montaje con éxito); si falla se repite al reintentar, cuando el equipo pudo cambiar. */
let webglKnownGood = false;
/**
 * deck.gl 9 dibuja con WebGL2: un equipo que solo tiene WebGL1 no puede pintar el mapa y, si se intentara, quedaría
 * un lienzo vacío o un error. Se comprueba WebGL2 y no se cae a WebGL1.
 */
function supportsWebGL(): boolean {
  if (webglKnownGood) return true;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    // El contexto de prueba se suelta en el acto: los navegadores limitan cuántos WebGL pueden vivir a la vez.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    webglKnownGood = true;
    return true;
  } catch {
    return false;
  }
}

/** Un error de dibujo del mapa no debe tumbar la página: se avisa y queda la red plana con su reintento. */
class MapBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Map3DLazy(props: Map3DProps) {
  const [ready, setReady] = useState(false);
  // Se cambia al mapa solo cuando el trozo ya resolvió: así el marcador nunca es un spinner y el montaje no suspende.
  const [Map3D, setMap3D] = useState<ComponentType<Map3DProps> | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  // Reinicia el límite de error al reintentar (si no, un mapa que falló una vez no volvería a dibujarse).
  const [attempt, setAttempt] = useState(0);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  // Pestaña oculta: el mapa se pausa. El estado inicial es visible para no romper la hidratación.
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // En pantalla manda el alta diferida; el mismo observador dice cuándo pausar el mapa ya montado.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelQuiet = () => {};
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        cancelQuiet();
        if (entry.isIntersecting && !ready && !failure) {
          cancelQuiet = onQuiet(() => setReady(true), {
            // La paleta de búsqueda y los menús son modales: nada de compilar WebGL debajo de lo que se escribe
            when: () => !document.querySelector('[aria-modal="true"]'),
          });
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelQuiet();
    };
  }, [ready, failure]);

  // Sin WebGL no se descarga siquiera el trozo de deck.gl: la causa más común de un fallo irrecuperable.
  useEffect(() => {
    if (!ready || Map3D || failure) return;
    if (!supportsWebGL()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- comprobación del navegador; no hay eventos que esperar
      setFailure("webgl");
      return;
    }
    let alive = true;
    void import("@/components/Map3D").then(
      (module) => {
        if (alive) setMap3D(() => module.default);
      },
      () => {
        if (alive) setFailure("import");
      },
    );
    return () => {
      alive = false;
    };
  }, [ready, Map3D, failure]);

  // Un contexto WebGL perdido (GPU reiniciada, pestaña descartada) se trata como fallo y ofrece reintento.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onLost = (event: Event) => {
      event.preventDefault();
      setFailure("runtime");
    };
    element.addEventListener("webglcontextlost", onLost, true);
    return () => element.removeEventListener("webglcontextlost", onLost, true);
  }, []);

  const retry = () => {
    setFailure(null);
    setMap3D(null);
    setAttempt((n) => n + 1);
    // Un clic explícito no espera a que la página quede en silencio: se vuelve a intentar ahora.
    setReady(true);
  };

  return (
    <div ref={ref} className="relative h-full min-h-80 w-full overflow-hidden bg-fill/30">
      {Map3D && !failure ? (
        <MapBoundary key={attempt} onError={() => setFailure("runtime")}>
          {/* Fuera de pantalla o con la pestaña oculta el reloj del mapa no corre; el contexto se conserva. */}
          <Map3D {...props} paused={props.paused || !inView || !visible} />
        </MapBoundary>
      ) : failure ? (
        <div className="absolute inset-0">
          <div className="absolute inset-0 p-8 opacity-60" aria-hidden>
            <NetworkPreview network={props.network} departments={props.departments} fleet={props.fleet} />
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="floating pointer-events-auto flex w-[min(30rem,100%)] flex-col items-start gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
              <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
              <p role="status" className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
                {FAILURE_TEXT[failure]}
              </p>
              <Button variant="secondary" onClick={retry} aria-label="Reintentar el mapa 3D">
                <RefreshCw aria-hidden />
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0">
          {/* Mientras llega el mapa 3D se ve la red dibujada en plano (la silueta del país con sus rutas) */}
          <div className="absolute inset-0 p-8 opacity-50" aria-hidden>
            <NetworkPreview network={props.network} departments={props.departments} fleet={props.fleet} />
          </div>
          <span
            role="status"
            className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
            Cargando cartografía 3D
          </span>
        </div>
      )}
    </div>
  );
}

export function MapLoading({ label = "Cargando cartografía 3D" }: { label?: string }) {
  return (
    <div role="status" className="flex h-full min-h-80 w-full items-center justify-center bg-fill/50">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
        {label}
      </div>
    </div>
  );
}
