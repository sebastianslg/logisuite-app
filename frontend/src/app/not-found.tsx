import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl font-bold tracking-tight text-muted-foreground">404</div>
      <h1 className="text-2xl font-bold">No encontramos lo que buscas</h1>
      <p className="max-w-md text-muted-foreground">
        El envío o la página no existe, o ya no está disponible. Revisa el código o vuelve a la lista de envíos.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/envios">Ir a envíos</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
