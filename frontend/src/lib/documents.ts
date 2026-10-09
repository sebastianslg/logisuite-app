import type { Mode } from "./types";

/**
 * Documentos que normalmente exige cada modo (misma lista que el PDF, en
 * backend/app/engine/pdf.py). Es una referencia: LogiSuite no los emite.
 */
export const DOCS_ALWAYS = ["Factura comercial o remisión", "Lista de empaque", "Póliza de seguro de la mercancía"];

export const DOCS_BY_MODE: Record<Mode, string[]> = {
  terrestre: ["Manifiesto electrónico de carga (RNDC)", "Remesa terrestre de carga"],
  fluvial: ["Manifiesto de carga fluvial", "Conocimiento de embarque fluvial"],
  maritimo: ["Conocimiento de embarque (B/L)", "Manifiesto de carga marítimo"],
  aereo: ["Guía aérea (AWB)", "Manifiesto de carga aérea"],
  ferreo: ["Carta de porte ferroviaria"],
};

export function requiredDocuments(modes: Mode[]): { doc: string; scope: string }[] {
  const unique = [...new Set(modes)];
  return [
    ...DOCS_ALWAYS.map((doc) => ({ doc, scope: "Todo el envío" })),
    ...unique.flatMap((m) => DOCS_BY_MODE[m].map((doc) => ({ doc, scope: m }))),
  ];
}
