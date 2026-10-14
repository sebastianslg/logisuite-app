import { PageHeader } from "@/components/page-header";
import { WarehouseForm } from "@/components/warehouses/warehouse-form";

export const metadata = { title: "Nueva bodega" };

export default function NuevaBodegaPage() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        title="Nueva bodega"
        description="Elige la ciudad y el rol: el rol define qué guarda y qué puede manejar. Puede haber varias bodegas en la misma ciudad, cada una con una función distinta."
      />
      <div className="mt-8">
        <WarehouseForm />
      </div>
    </div>
  );
}
