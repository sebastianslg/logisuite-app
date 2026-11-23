"use client";

import { Eye, LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth";

/**
 * Aviso permanente para la cuenta de invitado: puede recorrer y probar todo, pero el servidor rechaza cualquier cambio
 * (main.session_identity). Abajo a la izquierda en escritorio y sobre el dock en el celular; con «Salir» directo.
 */
export function GuestBanner() {
  const { user, logout } = useAuth();
  if (user?.username !== "invitado") return null;
  return (
    <div
      role="status"
      className="floating fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-3.5 text-xs md:bottom-5 md:left-5 md:translate-x-0 print:hidden"
    >
      <Eye className="size-3.5 shrink-0 text-primary" aria-hidden />
      <span>
        <b className="font-semibold">Modo invitado</b>
        <span className="text-muted-foreground"> · puedes probar todo, los cambios no se guardan</span>
      </span>
      <button
        type="button"
        onClick={() => void logout()}
        className="press flex h-7 items-center gap-1 rounded-full bg-fill px-2.5 font-medium outline-none hover:bg-fill/70 focus-visible:ring-[3px] focus-visible:ring-ring/60 pointer-coarse:h-9"
      >
        <LogOut className="size-3.5" aria-hidden />
        Salir
      </button>
    </div>
  );
}
