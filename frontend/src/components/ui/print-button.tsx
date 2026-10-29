"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Imprime la página tal como se ve (los estilos de impresión quitan el dock y los controles). */
export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
      <Printer />
      {label}
    </Button>
  );
}
