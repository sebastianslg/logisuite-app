"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBurst } from "@/components/ui/burst";

/** Botón primario que lanza una ráfaga de chispas al tocarlo, antes de navegar. */
export function BurstLink({ children, ...props }: ComponentProps<typeof Link>) {
  const { burst, layer } = useBurst(Sparkles, 7);
  return (
    <Button asChild>
      <Link {...props} onPointerDown={burst} className="relative overflow-visible">
        {children}
        {layer}
      </Link>
    </Button>
  );
}
