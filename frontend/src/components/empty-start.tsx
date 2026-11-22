import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStartAction {
  label: string;
  /** Destino si la acción es una navegación. */
  href?: string;
  /** Qué hace, si no navega (por ejemplo, abrir la importación que ya tiene la pantalla). */
  onClick?: () => void;
  icon?: LucideIcon;
}

/**
 * Inicio de una lista vacía: el sistema aún no tiene registros, así que en lugar de una tabla vacía se dice
 * qué hacer primero, con las acciones a la mano. Es distinto del vacío de un filtro, que ofrece quitarlos.
 * Presentacional: recibe los textos y las acciones desde cada pantalla.
 */
export function EmptyStart({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions: EmptyStartAction[];
  className?: string;
}) {
  return (
    <div role="status" data-empty-start className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {/* En papel no van botones: el encabezado de impresión deja solo el título y la explicación */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 print:hidden">
        {actions.map(({ label, href, onClick, icon: Icon }, i) => {
          const variant = i === 0 ? "default" : "secondary";
          const content = (
            <>
              {Icon && <Icon aria-hidden />}
              {label}
            </>
          );
          return href ? (
            <Button key={label} asChild variant={variant}>
              <Link href={href}>{content}</Link>
            </Button>
          ) : (
            <Button key={label} variant={variant} onClick={onClick}>
              {content}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
