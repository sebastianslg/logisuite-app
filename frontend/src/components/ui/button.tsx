"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

import { useBurst } from "@/components/ui/burst";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium press outline-none focus-visible:ring-[3px] focus-visible:ring-ring/80 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-solid text-primary-foreground hover:bg-solid/90 active:bg-solid/80",
        secondary: "bg-fill text-foreground hover:bg-fill/70",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-fill",
        ghost: "text-muted-foreground hover:bg-fill hover:text-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-4 pointer-coarse:h-11",
        sm: "h-8 rounded-md px-3 text-xs pointer-coarse:h-10",
        lg: "h-11 rounded-md px-6",
        icon: "size-9 pointer-coarse:size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Ícono de las chispas que salen al tocar (acciones clave: guardar, exportar, compartir, crear). */
    burst?: LucideIcon;
  };

function Button({ className, variant, size, asChild = false, burst, ...props }: ButtonProps) {
  if (burst && !asChild) return <BurstButton icon={burst} className={className} variant={variant} size={size} {...props} />;
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/** Botón con ráfaga de chispas: la capa vive dentro del botón, que deja ver lo que sale por su borde. */
function BurstButton({
  icon,
  className,
  variant,
  size,
  children,
  onPointerDown,
  ...props
}: Omit<ButtonProps, "asChild" | "burst"> & { icon: LucideIcon }) {
  const { burst, layer } = useBurst(icon, 6);
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }), "relative overflow-visible")}
      onPointerDown={(e) => {
        burst(e);
        onPointerDown?.(e);
      }}
      {...props}
    >
      {children}
      {layer}
    </button>
  );
}

export { Button, buttonVariants };
