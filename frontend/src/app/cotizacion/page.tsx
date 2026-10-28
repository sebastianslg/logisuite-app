import { Suspense } from "react";
import Link from "next/link";

import { PageHeader, Skeleton } from "@/components/page-header";
import { QuoteView } from "@/components/quote/quote-view";
import { apiPost } from "@/lib/api";
import type { SimulateResponse } from "@/lib/types";

export const metadata = { title: "Cotización" };

export default function CotizacionPage({ searchParams }: PageProps<"/cotizacion">) {
  return (
    <div className="page">
      <div className="print:hidden">
        <PageHeader
          title="Cotización"
          description="El costo que calcula el motor para este traslado más tu margen, listo para imprimir o guardar en PDF y enviar al cliente."
        />
      </div>
      <Suspense fallback={<Skeleton className="h-[720px]" />}>
        <Quote searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const PRIORITIES = ["tiempo", "costo", "balanceado"];

async function Quote({ searchParams }: { searchParams: PageProps<"/cotizacion">["searchParams"] }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const origen = one(q.origen) ?? "Bogotá";
  const destino = one(q.destino) ?? "Cartagena";
  const peso = Number(String(one(q.peso) ?? "20").replace(",", ".")) || 20;
  const prioridad = PRIORITIES.includes(one(q.prioridad) ?? "") ? one(q.prioridad) : "balanceado";
  const modos = (one(q.modos) ?? "").split(",").filter(Boolean);
  const res = await apiPost<SimulateResponse>("/api/routes/simulate", { origen, destino, peso_t: peso, prioridad, modos });
  if (!res.ok)
    return (
      <div className="glass rounded-3xl p-8">
        <p className="text-sm text-destructive">No se pudo calcular la ruta: {res.error}</p>
        <Link href="/red" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Volver al simulador
        </Link>
      </div>
    );
  const issued = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const number = `COT-${issued.getFullYear()}${pad(issued.getMonth() + 1)}${pad(issued.getDate())}-${pad(issued.getHours())}${pad(issued.getMinutes())}`;
  return <QuoteView data={res.data} issuedAt={issued.toISOString()} number={number} />;
}
