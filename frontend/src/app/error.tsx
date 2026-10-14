"use client";

import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Error al cargar una vista (por ejemplo, la API no responde): se explica y se puede reintentar. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
      <h1 className="text-2xl font-bold">No pudimos cargar esta vista</h1>
      <p className="max-w-md text-muted-foreground">
        El servidor de datos no respondió. Puede estar iniciando o sin conexión. Espera unos segundos e inténtalo de nuevo.
      </p>
      <Button onClick={reset}>
        <RotateCw /> Reintentar
      </Button>
    </div>
  );
}
