"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Vuelve a pedir los datos de la página cada N segundos, solo con la pestaña a la vista. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
