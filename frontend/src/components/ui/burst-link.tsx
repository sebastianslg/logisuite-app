"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBurst } from "@/components/ui/burst";
import { cn } from "@/lib/utils";

/** Botón primario (enlace) que lanza una ráfaga de chispas al tocarlo, antes de navegar. */
export function BurstLink({
  children,
  className,
  icon = Sparkles,
  onPointerDown,
  ...props
}: ComponentProps<typeof Link> & { icon?: LucideIcon }) {
  const { burst, layer } = useBurst(icon, 7);
  return (
    <Button asChild>
      <Link
        {...props}
        onPointerDown={(e) => {
          burst(e);
          onPointerDown?.(e);
        }}
        className={cn("relative overflow-visible", className)}
      >
        {children}
        {layer}
      </Link>
    </Button>
  );
}
