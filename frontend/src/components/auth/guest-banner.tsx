"use client";

import { useState } from "react";
import { Eye, LogOut, X } from "lucide-react";

import { useAuth } from "@/lib/auth";

const KEY = "westvane.aviso-invitado-oculto";

function wasHidden() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Aviso para la cuenta de invitado: puede recorrer y probar todo, pero el servidor rechaza cualquier cambio
 * (main.session_identity). Es una píldora pequeña que no tapa nada: arriba en el celular (lejos del dock y de las
 * hojas inferiores) y abajo a la izquierda en escritorio. Se cierra con la X durante la sesión; «Salir» cierra la sesión.
 */
export function GuestBanner() {
  const { user, logout } = useAuth();
  const [hidden, setHidden] = useState(wasHidden);
  if (user?.username !== "invitado" || hidden) return null;

  const hide = () => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* sin almacenamiento: se oculta igual hasta recargar */
    }
    setHidden(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[60] flex justify-center px-3 md:inset-x-auto md:top-auto md:bottom-5 md:left-5 md:justify-start md:px-0 print:hidden">
      <div role="status" className="floating pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-xs">
        <Eye className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="truncate">
          <b className="font-semibold">Modo invitado</b>
          <span className="text-muted-foreground"> · los cambios no se guardan</span>
        </span>
        <button
          type="button"
          onClick={() => void logout()}
          className="press flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-2.5 font-medium outline-none hover:bg-fill/70 focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <LogOut className="size-3.5" aria-hidden />
          Salir
        </button>
        <button
          type="button"
          onClick={hide}
          aria-label="Ocultar el aviso de modo invitado"
          className="press flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
