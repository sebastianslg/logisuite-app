import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, LogOut, MonitorSmartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/client";

interface Sesion {
  id: string;
  created_at: string | null;
  expires_at: string | null;
  browser: string;
  current: boolean;
}

/** "AAAA-MM-DD HH:MM:SS" (hora local del servidor) en el formato corto de es-CO: "22/11/26, 4:18 p. m.". */
function cuando(raw: string | null): string {
  if (!raw) return "";
  const fecha = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(fecha.getTime())) return raw;
  // Los espacios estrechos de es-CO se cambian por uno normal para que el texto se copie y se lea igual
  return fecha.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }).replace(/[\u00a0\u202f]/g, " ");
}

/** Tolerante con lo que falte o venga con otro tipo: la lista se dibuja con lo que haya. */
function leerSesion(raw: unknown): Sesion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : "",
    created_at: typeof r.created_at === "string" ? r.created_at : null,
    expires_at: typeof r.expires_at === "string" ? r.expires_at : null,
    browser: typeof r.browser === "string" && r.browser.trim() ? r.browser : "Navegador no identificado",
    current: r.current === true,
  };
}

function detalle(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Revisa la conexión e inténtalo de nuevo.";
}

/**
 * Mis sesiones: los navegadores donde esta cuenta tiene la sesión abierta, con la actual marcada, y el cierre de las
 * demás (la de aquí nunca se cierra). Igual que «Mi contraseña», decide si mostrarse preguntando /api/auth/me por su
 * cuenta: la sesión puede vivir solo en la cookie y el estado global del dock no se toca. Siempre está en el árbol y
 * oculta con `visibility` (no con `hidden`) para no cambiar los ids de hidratación del resto de Configuración y para
 * que el alto quede reservado desde el primer HTML: al confirmarse la sesión, las secciones de abajo no se mueven.
 * La página exige sesión (proxy), así que ese alto reservado nunca deja un hueco a la vista; si la comprobación
 * responde que no hay sesión, el panel sí se retira del flujo.
 *
 * La lista y su fila de acciones tampoco aparecen de golpe: la carga ya ocupa el sitio de una sesión y la acción está
 * desde el principio (deshabilitada), así el panel no empuja lo que viene después cuando llegan los datos.
 */
export function MySessions() {
  const { user } = useAuth();
  // Hay sesión si el navegador ya la conoce o si la cookie responde /api/auth/me (el fixture e2e entra así).
  // `null` es «todavía no se sabe»: mientras tanto se reserva el alto del panel.
  const [haySesion, setHaySesion] = useState<boolean | null>(null);
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);

  const visible = !!user || haySesion === true;

  useEffect(() => {
    if (user || haySesion !== null) return;
    let vigente = true;
    api<{ username?: string }>("/api/auth/me")
      .then(() => {
        if (vigente) setHaySesion(true);
      })
      .catch(() => {
        // Sin sesión no hay nada que listar: el panel sale del flujo (no deja un hueco)
        if (vigente) setHaySesion(false);
      });
    return () => {
      vigente = false;
    };
  }, [user, haySesion]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await api<{ items?: unknown[] }>("/api/auth/sessions");
      const lista = Array.isArray(r?.items) ? r.items.map(leerSesion).filter((s): s is Sesion => s !== null) : [];
      // La sesión actual primero, aunque el servidor ya la mande así
      lista.sort((a, b) => Number(b.current) - Number(a.current));
      setSesiones(lista);
    } catch (e) {
      setSesiones(null);
      setError(detalle(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la lista al conocerse la sesión
    void cargar();
  }, [visible, cargar]);

  // La confirmación se deshace sola si nadie la completa: un clic de más no cierra sesiones por accidente
  useEffect(() => {
    if (!confirmando) return;
    const t = window.setTimeout(() => setConfirmando(false), 6000);
    return () => window.clearTimeout(t);
  }, [confirmando]);

  const otras = (sesiones ?? []).filter((s) => !s.current).length;
  const cargandoLista = sesiones === null && !error;

  async function cerrarDemas() {
    setCerrando(true);
    setErrorCierre(null);
    try {
      const r = await api<{ closed?: number }>("/api/auth/sessions/close-others", { method: "POST" });
      const cerradas = typeof r?.closed === "number" ? r.closed : 0;
      setConfirmando(false);
      await cargar();
      if (cerradas === 0) {
        toast({ title: "No quedaban otras sesiones abiertas", tone: "info" });
      } else {
        toast({
          title: cerradas === 1 ? "Se cerró 1 sesión" : `Se cerraron ${cerradas} sesiones`,
          description: "Esta sesión sigue abierta.",
        });
      }
    } catch (e) {
      setErrorCierre(detalle(e));
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div hidden={haySesion === false && !user} className={visible ? undefined : "invisible"} aria-hidden={visible ? undefined : true}>
      <CollapsiblePanel title="Mis sesiones">
        <p className="text-xs text-muted-foreground">
          Los navegadores donde esta cuenta tiene la sesión abierta. «Cerrar las demás» cierra todas menos esta, que
          sigue abierta.
        </p>

        {/* El alto de una fila queda reservado desde la carga: la lista entra en su sitio y, con muchas sesiones,
            se desplaza dentro de su caja en vez de empujar el resto del panel */}
        <div className="mt-4 min-h-[4.25rem]">
          {cargandoLista && (
            <div aria-hidden className="flex items-center gap-3 py-3">
              <div className="skeleton size-4 shrink-0 rounded-sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="skeleton h-3.5 w-2/5 max-w-40 rounded-full" />
                <div className="skeleton h-3 w-3/5 max-w-56 rounded-full" />
              </div>
            </div>
          )}

          {sesiones && !error && (
            <ul
              aria-label="Sesiones abiertas"
              aria-busy={cargando}
              className="rule-list max-h-[17rem] overflow-y-auto pr-1 text-sm"
            >
              {sesiones.length === 0 && <li className="py-3 text-muted-foreground">No hay sesiones abiertas.</li>}
              {sesiones.map((s, i) => (
                <li key={s.id || `${s.created_at ?? "sesion"}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate">{s.browser}</span>
                      {s.current && <Badge tone="accent">Esta sesión</Badge>}
                    </span>
                    <span className="tabular mt-0.5 block text-xs text-muted-foreground">
                      {s.created_at ? `Inició el ${cuando(s.created_at)}` : "Fecha de inicio no informada"}
                      {s.expires_at ? ` · Vence el ${cuando(s.expires_at)}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div role="alert" className="mt-4 flex flex-col items-start gap-2">
            <p className="text-sm font-medium">No pudimos cargar tus sesiones</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="secondary" onClick={() => void cargar()} disabled={cargando}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Siempre presente (deshabilitada hasta saber si hay otras): así no aparece un bloque nuevo al cargar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={confirmando ? "destructive" : "secondary"}
            disabled={otras === 0 || cerrando || cargandoLista}
            aria-busy={cerrando}
            onClick={() => (confirmando ? void cerrarDemas() : setConfirmando(true))}
          >
            {cerrando ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LogOut aria-hidden />}
            {confirmando ? "Sí, cerrar las demás" : "Cerrar las demás"}
          </Button>
          {confirmando && (
            <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={cerrando}>
              Cancelar
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {cargandoLista
              ? "Cargando tus sesiones…"
              : otras === 0
                ? "No hay otras sesiones abiertas."
                : otras === 1
                  ? "Hay otra sesión abierta."
                  : `Hay ${otras} sesiones más abiertas.`}
          </span>
        </div>

        {errorCierre && (
          <div role="alert" className="mt-3 flex flex-col items-start gap-2">
            <p className="text-xs text-destructive">No pudimos cerrar las demás sesiones.</p>
            <p className="text-xs text-muted-foreground">{errorCierre}</p>
            <Button variant="secondary" onClick={() => void cerrarDemas()} disabled={cerrando}>
              Reintentar
            </Button>
          </div>
        )}
      </CollapsiblePanel>
    </div>
  );
}
