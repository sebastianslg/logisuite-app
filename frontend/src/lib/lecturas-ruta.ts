/** Las lecturas sin un propietario más específico comparten la vida de la ruta. Las escrituras no se
 * reintentan ni se presentan como canceladas: el servidor podría haberlas confirmado ya. */
let actual: { ruta: string; ctrl: AbortController } | undefined;

export function sincronizarLecturas() {
  if (actual && actual.ruta !== window.location.pathname) {
    actual.ctrl.abort();
    actual = undefined;
  }
}

export function lecturaDeRuta() {
  sincronizarLecturas();
  actual ??= { ruta: window.location.pathname, ctrl: new AbortController() };
  return actual.ctrl.signal;
}
