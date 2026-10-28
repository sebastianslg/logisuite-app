"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pie de página: aviso de datos simulados y enlaces a Metodología y a Créditos y licencias (no en el mapa a pantalla completa). */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/red") return null;
  return (
    <footer className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-8 text-xs text-muted-foreground md:px-8 lg:px-10 print:hidden">
      <span>Westvane · datos de operación simulados</span>
      <Link href="/metodologia" className="hover:text-foreground hover:underline">
        Metodología
      </Link>
      <Link href="/creditos" className="hover:text-foreground hover:underline">
        Créditos y licencias
      </Link>
    </footer>
  );
}
