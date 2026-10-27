"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` mientras React hidrata este componente y `true` después. Sirve a los controles que leen una
 * preferencia del navegador (tema, moneda) dentro de un límite de Suspense: el proveedor ya pudo
 * actualizarse con el valor guardado antes de que el límite se hidrate, y el HTML del servidor no lo tiene.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
