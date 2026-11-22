/**
 * Transición de vista (template.tsx se remonta en cada navegación): fundido de 220 ms con 4 px de subida.
 * Breve a propósito: en una herramienta de trabajo la página nueva debe estar lista, no presentarse.
 * Es una animación CSS (clase `view-in`, solo opacity y transform; quieta con «reducir movimiento»): así no depende de
 * que React hidrate, y el HTML del servidor ya se pinta, que es lo que cuenta para el LCP.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="view-in min-h-full">{children}</div>;
}
