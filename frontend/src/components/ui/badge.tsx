import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Etiquetas de estado: fondo tintado sin borde y texto en el color semántico. Siempre con ícono o texto. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-fill text-muted-foreground",
        accent: "bg-primary/12 text-primary",
        info: "bg-info/14 text-info",
        success: "bg-success/14 text-success",
        warning: "bg-warning/14 text-warning",
        danger: "bg-destructive/14 text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
