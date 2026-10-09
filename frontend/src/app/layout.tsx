import { Suspense } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { AppProvider } from "@/components/providers";
import { Sidebar } from "@/components/shell/sidebar";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LogiSuite TMS",
    template: "%s · LogiSuite TMS",
  },
  description:
    "Transportation Management System multimodal para la red logística de Colombia: carretera, río, mar, aire y ferrocarril.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppProvider>
          <div className="flex min-h-screen">
            {/* usePathname es dinámico en rutas con parámetros: la barra se
                transmite y mientras tanto se reserva su ancho */}
            <Suspense fallback={<aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-border bg-[#05080f]/90 md:block" />}>
              <Sidebar />
            </Suspense>
            <main className="min-w-0 flex-1 pt-14 md:pt-0">{children}</main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
