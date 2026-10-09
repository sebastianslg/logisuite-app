import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Red multimodal" };

// El mapa 3D (deck.gl + MapLibre) y el simulador se integran en la Fase 5.
export default function RedPage() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="GIS 3D"
        title="Red multimodal"
        description="Mapa 3D de corredores, flota en vivo y simulador de rutas multimodales."
      />
    </div>
  );
}
