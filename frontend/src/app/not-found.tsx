import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark className="size-12" />
      <div>
        <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]">No encontramos esta página</h1>
        <p className="mt-3 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground">
          El envío o la dirección no existe, o ya no está disponible. Revise el código o vuelva a un lugar conocido.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild size="lg">
          <Link href="/panel">Ir al resumen</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/envios">Ver envíos</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/">Presentación</Link>
        </Button>
      </div>
    </div>
  );
}
