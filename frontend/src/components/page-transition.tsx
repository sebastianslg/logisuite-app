import { ViewTransition } from "react";

const DIRECCION = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

/**
 * Deslizamiento entre una lista y su ficha (View Transitions de React). Va en cada página y no en la plantilla: la
 * plantilla raíz no se vuelve a montar al pasar de /envios a /envios/LS-…, porque la sección no cambia. Los enlaces de
 * la lista llevan el tipo `nav-forward` y los de «volver», `nav-back`; cualquier otra navegación (dock, Ctrl K, atrás del
 * navegador) no desliza (queda el fundido de la plantilla). El CSS está en globals.css.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={DIRECCION} exit={DIRECCION} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
