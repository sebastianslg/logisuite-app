import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "@/components/fleet/vehicle-form";

export const metadata = { title: "Nuevo vehículo" };

export default function NuevoVehiculoPage() {
  return (
    <div className="page page-narrow">
      <PageHeader
        title="Nuevo vehículo"
        description="Al guardarlo entra a la flota y empieza a recibir envíos de su modo. Su mantenimiento vence por los días o los kilómetros que indiques, lo que ocurra primero."
      />
      <div>
        <VehicleForm />
      </div>
    </div>
  );
}
