/**
 * Diagrama del grafo expandido por estados: cada nodo físico aparece una vez por modo (filas), los enlaces unen
 * estados del mismo modo y el transbordo es la arista vertical dentro de un mismo nodo. Ejemplo real de la red:
 * Bogotá → La Dorada por carretera, transbordo a barcaza y Río Magdalena hasta Barranquilla, frente a la
 * alternativa toda por carretera. SVG con los colores de la paleta, legible en claro, oscuro e impreso.
 */
export function RouteGraphDiagram() {
  const road = "var(--mode-terrestre)";
  const river = "var(--mode-fluvial)";
  const cols = [70, 300, 530];
  const rows = { terrestre: 70, fluvial: 190 };
  const node = (x: number, y: number, color: string, label: string, dim = false) => (
    <g opacity={dim ? 0.45 : 1}>
      <circle cx={x} cy={y} r={9} fill="var(--card)" stroke={color} strokeWidth={2.5} />
      <text x={x} y={y + 26} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
        {label}
      </text>
    </g>
  );
  return (
    <figure className="mt-6 rounded-2xl border border-border bg-card p-4">
      <svg viewBox="0 0 600 250" className="h-auto w-full" role="img" aria-labelledby="rg-title rg-desc">
        <title id="rg-title">Grafo expandido por estados</title>
        <desc id="rg-desc">
          Bogotá y La Dorada tienen un estado terrestre; La Dorada y Barranquilla, uno fluvial. La ruta elegida va por carretera
          de Bogotá a La Dorada, hace transbordo de camión a barcaza y sigue por el río Magdalena hasta Barranquilla. La
          alternativa toda por carretera aparece atenuada.
        </desc>
        <defs>
          <marker id="rg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--foreground)" />
          </marker>
        </defs>

        {/* Etiquetas de fila: un estado por modo */}
        <text x={8} y={rows.terrestre - 22} fontSize={11} fontWeight={600} fill={road}>
          Estado terrestre
        </text>
        <text x={8} y={rows.fluvial - 22} fontSize={11} fontWeight={600} fill={river}>
          Estado fluvial
        </text>

        {/* Alternativa toda por carretera (atenuada) */}
        <path d={`M${cols[0] + 10},${rows.terrestre - 8} C 250 10, 380 10, ${cols[2] - 10},${rows.terrestre - 8}`} fill="none" stroke={road} strokeWidth={2} strokeDasharray="5 5" opacity={0.45} />
        <text x={300} y={22} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
          alternativa: toda por carretera
        </text>

        {/* Ruta elegida */}
        <line x1={cols[0] + 11} y1={rows.terrestre} x2={cols[1] - 13} y2={rows.terrestre} stroke={road} strokeWidth={3} markerEnd="url(#rg-arrow)" />
        <text x={(cols[0] + cols[1]) / 2} y={rows.terrestre - 10} textAnchor="middle" fontSize={11} fill="var(--foreground)">
          Ruta del Sol · camión
        </text>
        <line x1={cols[1]} y1={rows.terrestre + 11} x2={cols[1]} y2={rows.fluvial - 13} stroke="var(--warning)" strokeWidth={2.5} strokeDasharray="4 4" markerEnd="url(#rg-arrow)" />
        <text x={cols[1] + 12} y={(rows.terrestre + rows.fluvial) / 2 + 4} fontSize={11} fill="var(--warning)" fontWeight={600}>
          transbordo: tiempo y costo de manipulación
        </text>
        <line x1={cols[1] + 11} y1={rows.fluvial} x2={cols[2] - 13} y2={rows.fluvial} stroke={river} strokeWidth={3} markerEnd="url(#rg-arrow)" />
        <text x={(cols[1] + cols[2]) / 2} y={rows.fluvial - 10} textAnchor="middle" fontSize={11} fill="var(--foreground)">
          Río Magdalena · barcaza
        </text>

        {node(cols[0], rows.terrestre, road, "Bogotá")}
        {node(cols[1], rows.terrestre, road, "")}
        {node(cols[1], rows.fluvial, river, "La Dorada")}
        {node(cols[2], rows.terrestre, road, "", true)}
        {node(cols[2], rows.fluvial, river, "Barranquilla")}
      </svg>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Un nodo físico (La Dorada) existe una vez por modo. Pasar de un estado al otro es el transbordo, y el algoritmo lo cuenta
        y lo cobra como cualquier otro tramo.
      </figcaption>
    </figure>
  );
}
