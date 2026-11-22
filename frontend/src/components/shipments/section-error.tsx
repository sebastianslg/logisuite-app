"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { catchError, type ErrorInfo } from "next/error";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SectionFallbackProps = {
  /** Qué no se pudo cargar, en una frase: «No pudimos cargar la bitácora.» */
  message: string;
  /** Contexto breve: qué sigue disponible o qué revisar. */
  description?: string;
  className?: string;
};

function SectionAlert({
  message,
  description,
  className,
  retrying = false,
  onRetry,
}: SectionFallbackProps & { retrying?: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-3", className)}>
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-medium">{message}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <Button variant="secondary" size="sm" className="pointer-coarse:min-h-11 print:hidden" onClick={onRetry} disabled={retrying}>
        <RotateCw className={cn(retrying && "motion-safe:animate-spin")} aria-hidden />
        {retrying ? "Reintentando…" : "Reintentar"}
      </Button>
    </div>
  );
}

/**
 * Una sección de la ficha que no pudo cargar sus datos (la lectura falló, no que el dato no exista):
 * avisa en español y ofrece «Reintentar», que vuelve a pedir los datos al servidor con `router.refresh()`
 * sin recargar la página; lo demás que ya está en pantalla se conserva.
 */
export function SectionError({
  message,
  description,
  className,
  onRetry,
}: SectionFallbackProps & { onRetry?: () => void }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  return (
    <SectionAlert
      message={message}
      description={description}
      className={className}
      retrying={retrying}
      onRetry={onRetry ?? (() => startRetry(() => router.refresh()))}
    />
  );
}

function SectionFallback({ message, description, className }: SectionFallbackProps, { retry }: ErrorInfo) {
  const [retrying, startRetry] = useTransition();
  return (
    <SectionAlert message={message} description={description} className={className} retrying={retrying}
      onRetry={() => startRetry(() => retry())} />
  );
}

/**
 * Límite de error de una sección: si su render revienta, solo esa tarjeta muestra el aviso y la ficha
 * entera sigue en pie. `retry()` vuelve a pedir y pintar esa parte sin tocar el resto.
 */
export const SectionBoundary = catchError(SectionFallback);
