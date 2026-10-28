import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";

import { CommandPalette } from "@/components/shell/command-palette";
import { Shortcuts } from "@/components/shell/shortcuts";
import { MotionProvider } from "@/components/motion-provider";
import { RippleRoot } from "@/components/ui/ripple";
import { Toaster } from "@/components/ui/toast";
import { AppProvider } from "@/components/providers";
import { Diagnostics } from "@/components/diagnostics";
import { Dock } from "@/components/shell/dock";
import { SiteFooter } from "@/components/shell/site-footer";

import { PrefsProvider, THEME_INIT_SCRIPT } from "@/lib/prefs";

import "./globals.css";

export const metadata: Metadata = {
  // Las imágenes para compartir (Open Graph) necesitan URL absoluta
  metadataBase: new URL(process.env.SITE_URL ?? "https://westvane.duckdns.org"),
  openGraph: { type: "website", locale: "es_CO", siteName: "Westvane TMS" },
  title: {
    default: "Westvane TMS",
    template: "%s · Westvane TMS",
  },
  description:
    "Transportation Management System multimodal para la red logística de Colombia: carretera, río, mar, aire y ferrocarril.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#f5f5f7" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="light" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <PrefsProvider>
          <AppProvider>
            <MotionProvider>
              <CommandPalette>
                <Shortcuts />
                <RippleRoot />
                <div className="print:hidden">
                  <Toaster />
                </div>
                {/* Panel de rendimiento: solo con ?diagnostico (usa usePathname: va en su propio límite) */}
                <Suspense fallback={null}>
                  <Diagnostics />
                </Suspense>
                {/* usePathname() en rutas dinámicas (/envios/[code]) exige un límite de Suspense */}
                <div className="print:hidden">
                  <Suspense fallback={null}>
                    <Dock />
                  </Suspense>
                </div>
                {/* El dock flota arriba en escritorio (5 rem) y abajo en celular (6 rem con el área segura) */}
                <main className="min-h-screen min-w-0 pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-20 md:pb-0 print:min-h-0 print:p-0">
                  {children}
                  <Suspense fallback={null}>
                    <SiteFooter />
                  </Suspense>
                </main>
              </CommandPalette>
            </MotionProvider>
          </AppProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
