"use client";

import { usePathname } from "next/navigation";

/** Páginas públicas (seguimiento para clientes): sin menú, avisos ni bienvenida de la app. */
export const PUBLIC_PREFIXES = ["/seguimiento"];
export const isPublicPath = (p: string) => PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));

/** Muestra a sus hijos solo en las páginas de la app (no en las públicas). */
export function ShellOnly({ children }: { children: React.ReactNode }) {
  return isPublicPath(usePathname()) ? null : <>{children}</>;
}
