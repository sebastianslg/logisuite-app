import { Suspense } from "react";

import { PageHeader, Skeleton } from "@/components/page-header";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { apiGet } from "@/lib/api";
import type { AuditEntry, Settings, ShareLink } from "@/lib/types";

export const metadata = { title: "Configuración" };

export default function ConfiguracionPage() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="Sistema"
        title="Configuración"
        description="Tasa de cambio, reposición automática de envíos simulados, enlaces compartidos e historial de cambios."
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[640px]" />}>
          <Panel />
        </Suspense>
      </div>
    </div>
  );
}

async function Panel() {
  const [settings, links, audit] = await Promise.all([
    apiGet<Settings>("/api/settings"),
    apiGet<{ items: ShareLink[] }>("/api/exports"),
    apiGet<{ items: AuditEntry[] }>("/api/audit?limit=300"),
  ]);
  return <SettingsPanel settings={settings} links={links.items} history={audit.items} />;
}
