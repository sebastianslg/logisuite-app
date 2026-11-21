import { AdminPanel } from "@/components/auth/admin-panel";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Administración" };

export default function AdministracionPage() {
  return (
    <div className="page">
      <PageHeader
        title="Administración"
        description="Solicitudes de demostración, usuarios, roles y empresas. Solo para administradores: cada persona ingresa con un código que le llega a su correo."
      />
      <AdminPanel />
    </div>
  );
}
