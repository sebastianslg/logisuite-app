import { Suspense } from "react";

import { NetworkExplorer } from "@/components/map/network-explorer";

export const metadata = { title: "Red multimodal" };

export default function RedPage() {
  // useSearchParams (filtros y atajos por URL) exige un límite de Suspense
  return (
    <Suspense fallback={null}>
      <NetworkExplorer />
    </Suspense>
  );
}
