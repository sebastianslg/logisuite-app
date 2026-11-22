"use client";

import { Component, type ReactNode } from "react";

/** Un gráfico que falla no debe llevarse consigo los filtros ni el resto del tablero. */
export class LimiteSeccion extends Component<{ nombre: string; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() { return { fallo: true }; }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div role="alert" className="rounded-xl bg-card p-4 text-sm">
        <p>No se pudo mostrar {this.props.nombre}.</p>
        <button type="button" className="mt-1 min-h-11 underline" onClick={() => this.setState({ fallo: false })}>Reintentar</button>
      </div>
    );
  }
}
