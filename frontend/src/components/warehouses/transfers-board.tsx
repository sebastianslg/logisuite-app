"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { WarehouseTransfer } from "@/lib/types";

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");

/** Traslados entre bodegas: lo que está en camino, lo recibido y lo cancelado. */
export function TransfersBoard({ transfers }: { transfers: WarehouseTransfer[] }) {
  const tone = { "En tránsito": "warning", Recibido: "success", Cancelado: "neutral" } as const;
  return (
    <ul className="flex flex-col gap-2">
      {transfers.length === 0 && (
        <li className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
          Todavía no hay traslados. Abre una bodega, elige un producto y pulsa “Trasladar”: si la otra bodega está en otra ciudad, se crea un envío por la red.
        </li>
      )}
      {transfers.map((t) => (
        <li key={t.transfer_id} className="glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/bodegas/${t.from_wh}`} className="font-medium hover:text-primary">{t.from_name}</Link>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            <Link href={`/bodegas/${t.to_wh}`} className="font-medium hover:text-primary">{t.to_name}</Link>
            <Badge tone={tone[t.status]} className="ml-auto">{t.status}</Badge>
          </div>
          <p className="tabular mt-1 text-xs text-muted-foreground">
            {t.qty.toLocaleString("es-CO")} × <span className="font-mono">{t.sku}</span> · {t.from_city} → {t.to_city} · creado {dt(t.created_at)}
            {t.received_at ? ` · recibido ${dt(t.received_at)}` : ""}
            {t.shipment_code ? <> · envío <Link href={`/envios/${t.shipment_code}`} className="font-mono hover:text-primary">{t.shipment_code}</Link></> : " · misma ciudad"}
          </p>
        </li>
      ))}
    </ul>
  );
}
