"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth";

/** La URL explícita manda. Se recuerdan controles, nunca el texto buscado (puede contener nombres). */
export function useVistaGuardada(ruta: string, permitidos: readonly string[]) {
  const { user } = useAuth();
  const router = useRouter();
  const clave = user ? `westvane.vista.${user.user_id}.${ruta}` : null;
  const leida = useRef<string | null>(null);
  useEffect(() => {
    if (!clave || leida.current === clave) return;
    leida.current = clave;
    if (location.pathname !== ruta || location.search || location.hash) return;
    try {
      const filtros = new URLSearchParams(localStorage.getItem(clave) ?? "");
      for (const k of [...filtros.keys()]) if (!permitidos.includes(k)) filtros.delete(k);
      if (filtros.size) router.replace(`${ruta}?${filtros}`, { scroll: false });
    } catch { /* sin almacenamiento, la URL sigue siendo suficiente */ }
  }, [clave, ruta, router, permitidos]);
  return (href: string) => {
    if (!clave) return;
    try {
      const filtros = new URL(href, location.origin).searchParams;
      for (const k of [...filtros.keys()]) if (!permitidos.includes(k)) filtros.delete(k);
      if (filtros.size) localStorage.setItem(clave, filtros.toString());
      else localStorage.removeItem(clave);
    } catch { /* preferencia opcional */ }
  };
}
