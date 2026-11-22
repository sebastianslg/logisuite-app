"use client";

import { useEffect } from "react";
import { sincronizarLecturas } from "@/lib/lecturas-ruta";

/** El template se monta también al navegar a una pantalla que no hace fetch desde el cliente. */
export function VigilarLecturas() {
  useEffect(sincronizarLecturas, []);
  return null;
}
