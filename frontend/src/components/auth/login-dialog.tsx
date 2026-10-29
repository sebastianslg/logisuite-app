"use client";

import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, KeyRound, AlertCircle, LogOut, Building2, X } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { T_VIEW } from "@/lib/motion";

export const OPEN_AUTH_MODAL_EVENT = "westvane:open-auth";

export function openAuthModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_AUTH_MODAL_EVENT));
  }
}

export function LoginDialog() {
  const { user, requestOtp, verifyOtp, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => {
      setErrorMessage(null);
      setStep("email");
      setCode("");
      setOpen(true);
    };
    window.addEventListener(OPEN_AUTH_MODAL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AUTH_MODAL_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, step]);

  const handleSendCode = async (targetEmail?: string) => {
    const toSend = (targetEmail || email).trim();
    if (!toSend) {
      setErrorMessage("Por favor ingresa tu correo electrónico institucional.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await requestOtp(toSend);
      setEmail(toSend);
      if (res.dev_code) {
        setDevCode(res.dev_code);
      }
      setStep("code");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error al solicitar código");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMessage("El código debe tener 6 dígitos numéricos.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      await verifyOtp(email, cleanCode);
      setOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const roleTone = (role: string) => {
    if (role === "admin") return "accent";
    if (role === "operador") return "info";
    return "neutral";
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          {/* Fondo difuminado */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={T_VIEW}
            className="fixed inset-0 bg-background/80 backdrop-blur-xs"
            onClick={() => setOpen(false)}
          />

          {/* Tarjeta del diálogo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={T_VIEW}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-surface p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
              <div>
                <h2 id="auth-modal-title" className="text-base font-semibold text-foreground">
                  {user ? "Sesión activa" : "Acceso institucional"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user ? "Detalles del usuario y permisos de empresa" : "Ingreso sin contraseña mediante código por correo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-fill hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>

            {user ? (
              <div className="pt-4 space-y-4">
                <div className="rounded-xl bg-fill/50 p-4 border border-border/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{user.full_name || user.username}</span>
                    <Badge tone={roleTone(user.role)}>{user.role_label || user.role}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5 text-muted-foreground" />
                      <span>{user.email || "Sin correo"}</span>
                    </div>
                    {user.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="size-3.5 text-muted-foreground" />
                        <span>{user.company.name} {user.company.nit ? `(${user.company.nit})` : ""}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Permisos asignados: </span>
                  {user.role_description}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Cerrar
                  </Button>
                  <Button variant="destructive" onClick={handleLogout} disabled={busy}>
                    <LogOut className="size-4 mr-1.5" />
                    Cerrar sesión
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-4 space-y-4">
                {errorMessage && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {step === "email" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendCode();
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label htmlFor="auth-email" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Correo electrónico
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                        <input
                          id="auth-email"
                          ref={inputRef}
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="usuario@westvane.com"
                          required
                          className="h-10 w-full rounded-xl bg-fill pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/80"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1.5">Cuentas demo para pruebas rápidas:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["admin@westvane.com", "operador@westvane.com", "lector@westvane.com"].map((demoEmail) => (
                          <button
                            key={demoEmail}
                            type="button"
                            onClick={() => {
                              setEmail(demoEmail);
                              void handleSendCode(demoEmail);
                            }}
                            className="text-[11px] rounded-lg bg-fill px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-fill-hover transition-colors"
                          >
                            {demoEmail.split("@")[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                        Cancelar
                      </Button>
                      <Button variant="default" type="submit" disabled={busy}>
                        {busy ? "Enviando..." : "Enviar código"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleVerifyCode();
                    }}
                    className="space-y-4"
                  >
                    <div className="text-xs text-muted-foreground">
                      Hemos enviado un código temporal de 6 dígitos a <strong className="text-foreground">{email}</strong>.
                    </div>

                    {devCode && (
                      <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary flex items-center justify-between">
                        <span>Código generado (modo local): <strong>{devCode}</strong></span>
                        <button
                          type="button"
                          onClick={() => setCode(devCode)}
                          className="text-[11px] underline font-medium hover:opacity-80"
                        >
                          Usar código
                        </button>
                      </div>
                    )}

                    <div>
                      <label htmlFor="auth-code" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Código de verificación (6 dígitos)
                      </label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
                        <input
                          id="auth-code"
                          ref={inputRef}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="123456"
                          required
                          className="h-10 w-full rounded-xl bg-fill pl-9 pr-3 text-center tracking-widest font-mono text-base outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/80"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("email");
                          setCode("");
                          setErrorMessage(null);
                        }}
                        className="text-muted-foreground hover:text-foreground underline"
                      >
                        Cambiar de correo
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendCode()}
                        disabled={busy}
                        className="text-primary hover:underline"
                      >
                        Reenviar código
                      </button>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                        Cancelar
                      </Button>
                      <Button variant="default" type="submit" disabled={busy || code.length !== 6}>
                        {busy ? "Verificando..." : "Ingresar"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
