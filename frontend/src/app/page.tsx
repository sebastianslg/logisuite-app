import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Portada provisional de la Fase 1: valida el tema y los componentes base.
// El Dashboard (Bento Grid + Framer Motion) se construye en la Fase 4.
export default function Home() {
  return (
    <main className="bg-grid mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-6">
      <Badge tone="cyan" className="uppercase tracking-widest">
        LogiSuite TMS · Multimodal
      </Badge>
      <h1 className="text-4xl font-semibold tracking-tight">
        Red logística de Colombia
      </h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Fundación del monorepo</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            Backend FastAPI en /backend y frontend Next.js en /frontend.
          </CardDescription>
        </CardContent>
      </Card>
    </main>
  );
}
