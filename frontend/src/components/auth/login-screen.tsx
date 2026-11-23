"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { MODES } from "@/lib/modes";
import type { Mode as TransportMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { getAuthToken, refreshUser, useAuth } from "@/lib/auth";

/**
 * A dónde volver después de ingresar: solo rutas de esta misma app (nunca otro sitio ni la propia pantalla de
 * ingreso). Se resuelve con `URL` y se compara el origen porque `//` y `/\` (que el navegador trata como `//`)
 * sacaban a otro dominio. El servidor no conoce el origen: ahí se queda en el panel y el cliente lo resuelve.
 */
function safeNext(raw: string | null): string {
  if (!raw || typeof window === "undefined") return "/panel";
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return "/panel";
    const path = `${u.pathname}${u.search}${u.hash}`;
    return path.startsWith("/ingresar") ? "/panel" : path;
  } catch {
    return "/panel";
  }
}

type Mode = "password" | "email" | "code";

/**
 * Pantalla de ingreso a la app: usuario o correo y contraseña. Quien tiene cuenta solo con correo pide un código (el
 * mismo ingreso de antes). Al entrar vuelve a la página que se quería abrir.
 */
export function LoginScreen() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { loginPassword, requestOtp, verifyOtp } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const navTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  // Ids estables para atar el error a los campos y el botón de la contraseña a su campo
  const errorId = useId();
  const passwordId = useId();

  // «Sesión iniciada» se queda el tiempo suficiente para que el lector lo lea; al desmontar se cancela la salida.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (navTimer.current !== null) {
        window.clearTimeout(navTimer.current);
        navTimer.current = null;
      }
    };
  }, []);

  // Con una sesión válida en este navegador no hace falta ingresar de nuevo
  useEffect(() => {
    if (!getAuthToken()) return;
    void refreshUser().then((u) => {
      if (u) window.location.replace(next);
    });
  }, [next]);

  useEffect(() => {
    first.current?.focus();
  }, [mode]);

  /** Tras un error, el botón deshabilitado deja el foco en <body>: se devuelve al primer campo con error. */
  const focusError = () => {
    requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? first.current;
      target?.focus();
    });
  };

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (done) {
        done();
        return;
      }
      // Se anuncia «Sesión iniciada» antes de navegar: la voz del lector no sobrevive al cambio de página.
      setEntered(true);
      if (navTimer.current !== null) window.clearTimeout(navTimer.current);
      navTimer.current = window.setTimeout(() => {
        navTimer.current = null;
        if (mounted.current) window.location.assign(next);
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ingresar.");
      setBusy(false);
      focusError();
    }
  };

  const switchTo = (m: Mode) => {
    setError(null);
    setMode(m);
  };

  // Lo que se anuncia mientras se espera al servidor (el botón queda deshabilitado y pierde el foco)
  const busyLabel = mode === "password" ? "Ingresando…" : mode === "email" ? "Enviando el código…" : "Verificando el código…";

  return (
    <div data-public-page className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 items-center px-4 sm:px-8">
        <Link href="/" aria-label="Westvane, inicio" className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60">
          <Wordmark />
        </Link>
      </header>

      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex items-start justify-center px-4 pt-[8vh] pb-16 sm:items-center sm:pt-0">
        <div className="rise-in w-full max-w-sm">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">Ingresar a Westvane</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {mode === "password"
              ? "Usa tu usuario o tu correo y tu contraseña."
              : mode === "email"
                ? "Te enviamos un código de 6 dígitos al correo de tu cuenta."
                : `Escribe el código que llegó a ${email}.`}
          </p>

          {error && (
            <p id={errorId} role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <p role="status" className="sr-only">
            {entered ? "Sesión iniciada. Abriendo la aplicación…" : busy ? busyLabel : ""}
          </p>

          {mode === "password" && (
            <form
              ref={formRef}
              className="mt-6 flex flex-col gap-4"
              aria-busy={busy}
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => loginPassword(identifier.trim(), password));
              }}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium">Usuario o correo</span>
                <input
                  ref={first}
                  className="field h-11 px-3 text-base"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={200}
                  value={identifier}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium">Contraseña</span>
                <span className="relative">
                  <input
                    id={passwordId}
                    className="field h-11 w-full pr-11 pl-3 text-base"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    maxLength={200}
                    value={password}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={show}
                    aria-controls={passwordId}
                    className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/80"
                  >
                    {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </span>
              </label>
              <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy || !identifier.trim() || !password}>
                {busy ? "Ingresando…" : "Ingresar"}
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => switchTo("email")}>
                <Mail aria-hidden />
                Recibir un código en el correo
              </Button>
              {/* Cuenta pública de invitado: ve y prueba todo, pero el servidor no guarda ningún cambio */}
              <div className="mt-2 rounded-2xl bg-fill px-4 py-3">
                <p className="text-sm font-medium">¿Solo quieres conocerla?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Entra como invitado (usuario <code className="font-mono">invitado</code>, clave <code className="font-mono">12345678</code>):
                  puedes recorrer y probar todo, pero los cambios no se guardan.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2.5"
                  disabled={busy}
                  onClick={() => void run(() => loginPassword("invitado", "12345678"))}
                >
                  Entrar como invitado
                </Button>
              </div>
            </form>
          )}

          {mode === "email" && (
            <form
              ref={formRef}
              className="mt-6 flex flex-col gap-4"
              aria-busy={busy}
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  async () => {
                    const res = await requestOtp(email.trim());
                    setDevCode(res.dev_code ?? null);
                  },
                  () => {
                    setBusy(false);
                    setCode("");
                    setMode("code");
                  },
                );
              }}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium">Correo electrónico</span>
                <input
                  ref={first}
                  className="field h-11 px-3 text-base"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={200}
                  value={email}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy || !email.trim()}>
                {busy ? "Enviando…" : "Enviar código"}
              </Button>
              <Button type="button" variant="ghost" className="self-center" onClick={() => switchTo("password")}>
                Ingresar con contraseña
              </Button>
            </form>
          )}

          {mode === "code" && (
            <form
              ref={formRef}
              className="mt-6 flex flex-col gap-4"
              aria-busy={busy}
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => verifyOtp(email.trim(), code));
              }}
            >
              {devCode && (
                <p className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
                  Código (modo local): <strong className="font-mono">{devCode}</strong>
                  <button type="button" className="rounded-md font-medium underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80" onClick={() => setCode(devCode)}>
                    Usar código
                  </button>
                </p>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium">Código de 6 dígitos</span>
                <input
                  ref={first}
                  className="field h-11 px-3 text-center font-mono text-lg tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>
              <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy || code.length !== 6}>
                {busy ? "Verificando…" : "Ingresar"}
              </Button>
              <Button type="button" variant="ghost" className="self-center" onClick={() => switchTo("email")}>
                Cambiar de correo o pedir otro código
              </Button>
            </form>
          )}

          <Link
            href="/"
            className="mt-10 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver a la presentación
          </Link>
        </div>
      </div>
      <NetworkPanel />
      </div>
    </div>
  );
}

const NETWORK: [TransportMode, number][] = [
  ["aereo", 13437],
  ["terrestre", 12628],
  ["fluvial", 4480],
  ["maritimo", 3340],
  ["ferreo", 1464],
];
const TOTAL_KM = NETWORK.reduce((a, [, km]) => a + km, 0);

/**
 * Panel de escritorio junto al ingreso: la red real que la persona va a operar. Un trazo por modo, del largo de su red
 * (el más largo llena la fila), que se dibuja al entrar y queda quieto. Con ícono y nombre: el modo nunca es solo color.
 */
function NetworkPanel() {
  const max = NETWORK[0][1];
  return (
    <aside aria-label="La red de Westvane" className="relative hidden overflow-hidden border-l border-border bg-card lg:-mt-16 lg:flex lg:flex-col lg:justify-center lg:px-16 lg:pt-16 xl:px-24">
      <p className="text-xs font-medium tracking-[0.02em] text-muted-foreground">La red que vas a operar</p>
      <p className="mt-3 text-[3.5rem] leading-none font-semibold tracking-[-0.045em] tabular">
        {TOTAL_KM.toLocaleString("es-CO")} <span className="text-[1.75rem] tracking-[-0.03em] text-muted-foreground">km</span>
      </p>
      <p className="mt-3 max-w-[40ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
        Carretera, río, mar, aire y tren de Colombia, con sus nodos, transbordos y cierres reales.
      </p>
      <ul className="mt-10 flex flex-col gap-5">
        {NETWORK.map(([m, km], i) => {
          const { icon: Icon, color, label } = MODES[m];
          return (
            <li key={m} className="grid grid-cols-[7.5rem_minmax(0,1fr)_4.5rem] items-center gap-4 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
                {label}
              </span>
              <span className="relative h-2" aria-hidden>
                <span className="absolute inset-0 rounded-full bg-fill" />
                <span
                  className="network-seg absolute inset-y-0 left-0 !h-full"
                  style={{ width: `${(km / max) * 100}%`, backgroundColor: color, "--i": i + 2 } as React.CSSProperties}
                />
              </span>
              <span className="tabular text-right text-muted-foreground">{km.toLocaleString("es-CO")} km</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
