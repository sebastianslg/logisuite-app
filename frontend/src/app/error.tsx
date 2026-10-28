"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Error al cargar una vista (por ejemplo, la API no responde): se explica qué pasó y qué hacer. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // El error vino del servidor: hay que volver a pedir los datos (refresh) además de reintentar el render
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
      <h1 className="text-2xl font-bold">No pudimos cargar esta vista</h1>
      <p className="max-w-md text-muted-foreground">
        La interfaz no logró hablar con el servidor de datos. Si acaba de iniciar, puede tardar hasta un minuto en
        despertar: espera un momento y vuelve a intentarlo.
      </p>
      <Button onClick={retry}>
        <RotateCw /> Reintentar
      </Button>
      <p className="max-w-md text-xs text-muted-foreground">
        Si sigue fallando, comprueba que la API esté en línea y que <span className="font-mono">API_INTERNAL_URL</span>{" "}
        apunte a ella.
        {error.digest && (
          <>
            {" "}
            Referencia: <span className="font-mono">{error.digest}</span>
          </>
        )}
      </p>
    </div>
  );
}
