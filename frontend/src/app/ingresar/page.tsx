import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Ingreso a Westvane TMS con usuario o correo y contraseña.",
  robots: { index: false, follow: false },
};

/** Pantalla de ingreso: la app pide sesión (ver `src/proxy.ts`); la presentación y el seguimiento siguen abiertos. */
export default function IngresarPage() {
  return (
    <Suspense fallback={<div data-public-page className="min-h-dvh" />}>
      <LoginScreen />
    </Suspense>
  );
}
