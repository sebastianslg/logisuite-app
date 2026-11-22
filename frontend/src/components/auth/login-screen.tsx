"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getAuthToken, refreshUser, useAuth } from "@/lib/auth";

/** A dónde volver después de ingresar: solo rutas de esta misma app (nunca otro sitio ni la propia pantalla de ingreso). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/ingresar")) return "/panel";
  return raw;
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
  const first = useRef<HTMLInputElement>(null);

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

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (done) done();
      else window.location.assign(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ingresar.");
      setBusy(false);
    }
  };

  const switchTo = (m: Mode) => {
    setError(null);
    setMode(m);
  };

  return (
    <div data-public-page className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 items-center px-4 sm:px-8">
        <Link href="/" aria-label="Westvane, inicio" className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60">
          <Wordmark />
        </Link>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16 sm:items-center sm:pt-0">
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
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {mode === "password" && (
            <form
              className="mt-6 flex flex-col gap-4"
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
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium">Contraseña</span>
                <span className="relative">
                  <input
                    className="field h-11 w-full pr-11 pl-3 text-base"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    maxLength={200}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={show}
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
            </form>
          )}

          {mode === "email" && (
            <form
              className="mt-6 flex flex-col gap-4"
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
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => verifyOtp(email.trim(), code));
              }}
            >
              {devCode && (
                <p className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
                  Código (modo local): <strong className="font-mono">{devCode}</strong>
                  <button type="button" className="font-medium underline" onClick={() => setCode(devCode)}>
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
    </div>
  );
}
