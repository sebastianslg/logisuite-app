import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado vacío: una cifra o un título breve, una frase que dice qué hacer y, si hay algo que hacer, el botón
 * que lo hace. Sin ilustraciones ni íconos grandes: el vacío se explica, no se decora.
 */
export function EmptyState({
  title,
  description,
  figure,
  action,
  className,
}: {
  title: string;
  description?: string;
  /** Cifra grande opcional (por ejemplo "0"). */
  figure?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {figure && (
        <span className="tabular mb-3 text-5xl leading-none font-semibold tracking-[-0.045em] text-muted-foreground/50">{figure}</span>
      )}
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action &&
        (action.href ? (
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
