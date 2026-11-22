/**
 * Une una señal de cancelación con un plazo, sin `AbortSignal.any` ni `AbortSignal.timeout`:
 * Safari 15 y anteriores no las traen y la app tiene que funcionar allí.
 *
 * Quien la use debe llamar a `liberar()` al terminar (también si la petición falla o se cancela):
 * quita el temporizador y el escucha, así no queda trabajo colgando ni se abortan señales ajenas.
 */
export interface SenalConPlazo {
  signal: AbortSignal;
  /** `true` si venció el plazo; no si la canceló la señal de quien llama. */
  vencido: () => boolean;
  /** Suelta el temporizador y el escucha. Se puede llamar más de una vez. */
  liberar: () => void;
}

export function senalConPlazo(externa: AbortSignal | undefined, ms: number): SenalConPlazo {
  const control = new AbortController();
  let vencido = false;
  let suelto = false;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  function liberar() {
    if (suelto) return;
    suelto = true;
    if (temporizador !== undefined) {
      clearTimeout(temporizador);
      temporizador = undefined;
    }
    externa?.removeEventListener("abort", alCancelar);
  }

  function alCancelar() {
    control.abort(externa?.reason);
    liberar();
  }

  // Ya venía cancelada: la petición debe fallar de inmediato y no hay nada que escuchar
  if (externa?.aborted) {
    control.abort(externa.reason);
    return { signal: control.signal, vencido: () => false, liberar: () => {} };
  }

  externa?.addEventListener("abort", alCancelar, { once: true });
  temporizador = setTimeout(() => {
    vencido = true;
    control.abort();
    liberar();
  }, Math.max(0, ms));

  return { signal: control.signal, vencido: () => vencido, liberar };
}
