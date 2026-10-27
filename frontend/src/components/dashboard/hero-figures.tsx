"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

import { useApp } from "@/components/providers";
import { CountUp } from "@/components/ui/count-up";
import { EASE, stagger } from "@/lib/motion";

/**
 * Cifras hero del resumen: envíos en ruta, retrasos y costo acumulado (flete comprometido de lo que está
 * en tránsito). Tipografía grande con tracking negativo, separadas por hairlines; cada una abre la lista
 * filtrada. Las cifras cuentan al cargar y, cuando cambian, desde el valor anterior.
 */
export function HeroFigures({
  inTransit,
  delayed,
  cost,
}: {
  inTransit: number;
  delayed: number;
  cost: number;
}) {
  const { money } = useApp();
  const items = [
    { label: "Envíos en ruta", value: inTransit, href: "/envios?estado=En Ruta,Transferencia Modal,Retrasado" },
    { label: "Retrasos", value: delayed, href: "/envios?estado=Retrasado", danger: delayed > 0 },
    { label: "Costo acumulado en tránsito", value: cost, href: "/envios?estado=En Ruta,Transferencia Modal,Retrasado", money: true },
  ];
  return (
    <section aria-label="Cifras principales" className="mb-6 grid rounded-[20px] bg-card md:grid-cols-3">
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: stagger(i, 0.06, 0.4) }}
          className="border-border not-first:border-t md:not-first:border-t-0 md:not-first:border-l"
        >
          <Link
            href={it.href}
            className="group press block rounded-[20px] px-6 py-6 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 md:px-7 md:py-8"
          >
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
              {it.label}
              <ArrowUpRight className="size-3.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden />
            </span>
            <CountUp
              value={it.value}
              format={it.money ? (n) => money(n, true) : undefined}
              className={`tabular mt-2 block text-[2.75rem] leading-none font-semibold tracking-[-0.045em] md:text-[clamp(2rem,4vw,4rem)] ${it.danger ? "text-destructive" : ""}`}
            />
          </Link>
        </motion.div>
      ))}
    </section>
  );
}
