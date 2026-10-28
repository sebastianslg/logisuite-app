"use client";

import { useState } from "react";
import Link from "next/link";
import { PackagePlus, Printer } from "lucide-react";

import { useApp } from "@/components/providers";
import { ModeChain } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { PRIORITIES } from "@/lib/modes";
import type { SimulateResponse } from "@/lib/types";

const fmtDate = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

/**
 * Cotización de un traslado a partir de la ruta simulada: el costo calculado por el motor más un margen, en la
 * moneda elegida, con vigencia. Los campos se editan en pantalla y el documento se imprime o guarda en PDF desde
 * el navegador (los estilos de impresión dejan solo la hoja).
 */
export function QuoteView({ data, issuedAt, number }: { data: SimulateResponse; issuedAt: string; number: string }) {
  const { money, currency, fx } = useApp();
  const r = data.route;
  const b = r.cost_breakdown;
  const [client, setClient] = useState("");
  const [margin, setMargin] = useState("18");
  const [validity, setValidity] = useState("15");
  const [notes, setNotes] = useState("Incluye manipulación en transbordos. No incluye seguro de la mercancía ni almacenamiento en destino.");

  const m = Math.max(0, Number(margin.replace(",", ".")) || 0);
  const price = r.cost * (1 + m / 100);
  const issued = new Date(issuedAt);
  const until = new Date(issued.getTime() + (Number(validity) || 0) * 86_400_000);
  const rows: [string, number][] = b
    ? [
        ["Fletes por tramo", b.fletes],
        ["Peajes", b.peajes],
        ["Manipulación en transbordos", b.manipulacion],
        ["Impuestos (IVA e ICA)", b.impuestos],
      ]
    : [["Costo de transporte", r.cost]];

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] print:block">
      <aside className="glass flex h-fit flex-col gap-3 rounded-3xl p-5 print:hidden xl:sticky xl:top-24">
        <h2 className="text-sm font-semibold">Datos de la cotización</h2>
        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Cliente</span>
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nombre del cliente" className="field h-10 w-full px-3 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Margen (%)</span>
            <input inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} className="field tabular h-10 w-full px-3 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Vigencia (días)</span>
            <input inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value)} className="field tabular h-10 w-full px-3 text-sm" />
          </label>
        </div>
        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Condiciones</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="field w-full resize-y px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-muted-foreground">Moneda: {currency}{currency === "COP" && fx?.rate ? ` (TRM ${fx.rate.toLocaleString("es-CO")})` : ""}. Cámbiala en el dock.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => window.print()}>
            <Printer /> Imprimir o guardar PDF
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/envios/nuevo?origin=${encodeURIComponent(r.origin)}&destination=${encodeURIComponent(r.destination)}&priority=${r.priority}&weight=${r.weight_t}`}>
              <PackagePlus /> Crear envío
            </Link>
          </Button>
        </div>
      </aside>

      <article aria-label="Cotización" className="glass rounded-3xl p-8 md:p-10 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div>
            <div className="text-sm font-semibold tracking-[-0.01em]">Westvane TMS</div>
            <h2 className="mt-3 text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">Cotización</h2>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{number}</div>
          </div>
          <dl className="tabular grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{fmtDate(issued)}</dd>
            <dt className="text-muted-foreground">Válida hasta</dt>
            <dd>{fmtDate(until)}</dd>
            <dt className="text-muted-foreground">Cliente</dt>
            <dd className="font-medium">{client || "—"}</dd>
          </dl>
        </header>

        <section className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Traslado</h3>
            <p className="mt-1 text-lg font-medium">
              {r.origin} <span className="text-muted-foreground">→</span> {r.destination}
            </p>
            <div className="mt-2">
              <ModeChain modes={r.modes} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{r.mode_labels.join(" → ")}</p>
          </div>
          <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Carga</dt>
            <dd className="text-right">{r.weight_fmt}</dd>
            <dt className="text-muted-foreground">Tiempo estimado</dt>
            <dd className="text-right">{r.time_fmt}</dd>
            <dt className="text-muted-foreground">Distancia</dt>
            <dd className="text-right">{r.distance_fmt}</dd>
            <dt className="text-muted-foreground">Transbordos</dt>
            <dd className="text-right">{r.n_transfers}</dd>
            <dt className="text-muted-foreground">Criterio</dt>
            <dd className="text-right">{PRIORITIES[r.priority]}</dd>
            <dt className="text-muted-foreground">CO₂e estimado</dt>
            <dd className="text-right">{data.footprint.co2e_fmt}</dd>
          </dl>
        </section>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="pb-2 text-left font-medium">Concepto</th>
              <th className="pb-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-border">
                <td className="py-2.5">{k}</td>
                <td className="py-2.5 text-right">{money(v)}</td>
              </tr>
            ))}
            <tr className="border-b border-border text-muted-foreground">
              <td className="py-2.5">Costo de transporte</td>
              <td className="py-2.5 text-right">{money(r.cost)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2.5">Margen ({m.toLocaleString("es-CO")} %)</td>
              <td className="py-2.5 text-right">{money(price - r.cost)}</td>
            </tr>
          </tbody>
          <tfoot className="tabular">
            <tr>
              <td className="pt-4 text-base font-semibold">Precio total</td>
              <td className="pt-4 text-right text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">{money(price)}</td>
            </tr>
            <tr>
              <td className="pt-1 text-xs text-muted-foreground">Por tonelada</td>
              <td className="pt-1 text-right text-xs text-muted-foreground">{money(price / (r.weight_t || 1))}</td>
            </tr>
          </tfoot>
        </table>

        {notes && (
          <section className="mt-8">
            <h3 className="text-xs font-medium text-muted-foreground">Condiciones</h3>
            <p className="mt-1 text-sm whitespace-pre-line">{notes}</p>
          </section>
        )}
        <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          Cotización referencial calculada con la red y las tarifas vigentes en Westvane (datos de operación simulados). El tiempo es
          estimado y no incluye esperas en origen o destino. Impuestos según los parámetros configurados.
        </p>
      </article>
    </div>
  );
}
