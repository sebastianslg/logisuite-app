"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Search } from "lucide-react";

import { CATEGORY_LABEL } from "@/components/map/city-combobox";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { MODES } from "@/lib/modes";
import type { CityCategory, CityOption } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CATEGORY_FILTERS: { value: CityCategory; label: string }[] = [
  { value: "principal", label: "Ciudades principales" },
  { value: "municipio", label: "Municipios" },
  { value: "dificil_acceso", label: "Difícil acceso" },
];

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Chips para elegir qué categorías de ciudades ver y usar; "Todos" las activa todas. */
export function CategoryFilter({
  cities,
  value,
  onChange,
}: {
  cities: CityOption[];
  value: ReadonlySet<CityCategory>;
  onChange: (next: Set<CityCategory>) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<CityCategory, number> = { principal: 0, municipio: 0, dificil_acceso: 0 };
    cities.forEach((x) => (c[x.category] += 1));
    return c;
  }, [cities]);
  const all = value.size === CATEGORY_FILTERS.length;
  const toggle = (cat: CityCategory) => {
    const next = new Set(value);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    // Nunca se queda sin categorías: sin ciudades no hay nada que simular
    onChange(next.size ? next : new Set(CATEGORY_FILTERS.map((f) => f.value)));
  };
  const chip = (active: boolean) =>
    cn(
      "press h-8 rounded-full px-3 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-10",
      active ? "bg-solid text-primary-foreground" : "bg-fill text-foreground/80 hover:bg-fill/70",
    );
  return (
    <div role="group" aria-label="Categorías de ciudades" className="flex flex-wrap gap-1.5">
      <button type="button" className={chip(all)} aria-pressed={all} onClick={() => onChange(new Set(CATEGORY_FILTERS.map((f) => f.value)))}>
        Todos <span className="tabular opacity-70">{cities.length}</span>
      </button>
      {CATEGORY_FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          className={chip(!all && value.has(f.value))}
          aria-pressed={!all && value.has(f.value)}
          onClick={() => (all ? onChange(new Set([f.value])) : toggle(f.value))}
        >
          {f.label} <span className="tabular opacity-70">{counts[f.value]}</span>
        </button>
      ))}
    </div>
  );
}

/** Directorio de ciudades (hoja): buscar, filtrar por categoría y abrir una para usarla o verla en el mapa. */
export function CityDirectory({
  open,
  onClose,
  cities,
  categories,
  onCategories,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  cities: CityOption[];
  categories: ReadonlySet<CityCategory>;
  onCategories: (c: Set<CityCategory>) => void;
  onPick: (city: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = norm(q.trim());
    return cities.filter((c) => categories.has(c.category) && (!needle || norm(c.city).includes(needle)));
  }, [cities, categories, q]);
  return (
    <Sheet open={open} onClose={onClose} title="Ciudades y municipios" description={`${list.length} de ${cities.length} en la red`}>
      <div className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ciudad o municipio"
            aria-label="Buscar ciudad o municipio"
            className="h-10 w-full rounded-xl bg-fill pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-[3px] focus:ring-ring/50"
          />
        </label>
        <CategoryFilter cities={cities} value={categories} onChange={onCategories} />
        <ul className="flex flex-col gap-1.5">
          {list.map((c) => (
            <li key={c.city}>
              <button
                type="button"
                onClick={() => onPick(c.city)}
                className="press flex w-full items-center gap-3 rounded-2xl bg-fill px-3 py-2.5 text-left outline-none hover:bg-fill/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.city}</span>
                  <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[c.category]}</span>
                </span>
                <span className="flex gap-1" aria-hidden>
                  {c.modes.map((m) => {
                    const Icon = MODES[m].icon;
                    return <Icon key={m} className="size-3.5" style={{ color: MODES[m].color }} />;
                  })}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Ninguna ciudad coincide.</li>}
        </ul>
      </div>
    </Sheet>
  );
}

/** Inspector de una ciudad: qué es, cómo se llega y atajos para usarla en el simulador. */
export function CityInspector({
  city,
  onClose,
  onOrigin,
  onDestination,
}: {
  city: CityOption | null;
  onClose: () => void;
  onOrigin: (c: string) => void;
  onDestination: (c: string) => void;
}) {
  return (
    <Sheet open={!!city} onClose={onClose} title={city?.city ?? ""} description={city ? CATEGORY_LABEL[city.category] : undefined}>
      {city && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {city.modes.map((m) => {
              const Icon = MODES[m].icon;
              return (
                <span key={m} className="flex items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-sm">
                  <Icon className="size-4" style={{ color: MODES[m].color }} aria-hidden />
                  {MODES[m].label}
                </span>
              );
            })}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Nodos logísticos</h3>
            <ul className="flex flex-col gap-1.5">
              {city.nodes.map((n) => (
                <li key={n.code} className="flex justify-between gap-3 rounded-2xl bg-fill px-3 py-2 text-sm">
                  <span className="truncate">{n.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{n.code}</span>
                </li>
              ))}
            </ul>
          </div>
          {city.category === "dificil_acceso" && (
            <p className="rounded-2xl bg-warning/12 p-3 text-sm text-warning">
              Sin vía terrestre conectada a la red: solo se llega por río, mar o aire, por lo que el tiempo y el costo suelen ser mayores.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onOrigin(city.city)}>Usar como origen</Button>
            <Button variant="secondary" onClick={() => onDestination(city.city)}>
              Usar como destino
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/envios?q=${encodeURIComponent(city.city)}`}>Ver envíos de {city.city}</Link>
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
