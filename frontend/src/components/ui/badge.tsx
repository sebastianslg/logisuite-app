import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Badges translúcidos: fondo al 10%, borde al 25% y texto en el color pleno. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-white/10 bg-white/[0.04] text-slate-300",
        cyan: "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan",
        cobalt: "border-neon-cobalt/30 bg-neon-cobalt/10 text-[#7da2ff]",
        emerald: "border-neon-emerald/25 bg-neon-emerald/10 text-neon-emerald",
        amber: "border-neon-amber/25 bg-neon-amber/10 text-neon-amber",
        violet: "border-neon-violet/25 bg-neon-violet/10 text-neon-violet",
        rose: "border-neon-rose/25 bg-neon-rose/10 text-neon-rose",
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
