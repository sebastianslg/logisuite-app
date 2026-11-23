import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { CommandPalette } from "@/components/shell/command-palette";
import { Shortcuts } from "@/components/shell/shortcuts";
import { LoginDialog } from "@/components/auth/login-dialog";
import { MotionProvider } from "@/components/motion-provider";
import { RippleRoot } from "@/components/ui/ripple";
import { Toaster } from "@/components/ui/toast";
import { AppProvider } from "@/components/providers";
import { Diagnostics } from "@/components/diagnostics";
import { ErrorReporter } from "@/components/error-reporter";
import { OfflineBanner } from "@/components/offline-banner";
import { GuestBanner } from "@/components/auth/guest-banner";
import { ConsentGate } from "@/components/legal/consent-gate";
import { Dock } from "@/components/shell/dock";
import { ShellOnly } from "@/components/shell/shell-only";
import { SiteFooter } from "@/components/shell/site-footer";

import { PrefsProvider, THEME_INIT_SCRIPT } from "@/lib/prefs";

import "./globals.css";

/**
 * Inter Variable, solo el archivo latino (los acentos del español caben ahí): se sirve desde el propio sitio con
 * `display: swap` y se precarga, en lugar de arrastrar las siete hojas de subconjuntos que traía el paquete. La
 * familia se llama igual que antes para que `--font-sans` y el resto de la hoja de estilos sigan apuntando a ella.
 */
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  declarations: [{ prop: "font-family", value: "Inter Variable" }],
});

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
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#111316" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="light" className={`h-full antialiased ${inter.className}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {/*
          «Saltar al contenido»: el primer elemento enfocable de la página, antes del dock. Queda fuera de la vista
          (arriba del borde) y aparece al recibir el foco; sin transición, así no hay movimiento que reducir. El
          destino es el <main id="contenido"> con tabIndex -1, que recibe el foco al pulsar Enter.
        */}
        <a
          href="#contenido"
          className="fixed top-0 left-3 z-[60] min-h-11 -translate-y-full rounded-full bg-card px-5 py-3 text-sm font-semibold whitespace-nowrap text-foreground outline-none focus:translate-y-[calc(env(safe-area-inset-top)_+_0.75rem)] focus:shadow-[var(--float-shadow)] focus-visible:ring-[3px] focus-visible:ring-ring/80 print:hidden"
        >
          Saltar al contenido
        </a>
        <PrefsProvider>
          <AppProvider>
            <MotionProvider>
              <CommandPalette>
                <Shortcuts />
                <LoginDialog />
                <RippleRoot />
                <div className="print:hidden">
                  <Toaster />
                </div>
                <ErrorReporter />
                <OfflineBanner />
                <Suspense fallback={null}>
                  <ShellOnly>
                    <GuestBanner />
                  </ShellOnly>
                </Suspense>
                {/* Aceptación de términos y datos la primera vez (o cuando cambian); usa usePathname */}
                <Suspense fallback={null}>
                  <ShellOnly>
                    <ConsentGate />
                  </ShellOnly>
                </Suspense>
                {/* Panel de rendimiento: solo con ?diagnostico (usa usePathname: va en su propio límite) */}
                <Suspense fallback={null}>
                  <Diagnostics />
                </Suspense>
                {/* usePathname() en rutas dinámicas (/envios/[code]) exige un límite de Suspense */}
                <div className="print:hidden">
                  <Suspense fallback={null}>
                    <ShellOnly>
                      <Dock />
                    </ShellOnly>
                  </Suspense>
                </div>
                {/* Destino del enlace «Saltar al contenido»: recibe el foco (sin anillo: no es interactivo). */}
                {/* El dock flota arriba en escritorio (5 rem) y abajo en celular (6 rem con el área segura) */}
                <main
                  id="contenido"
                  tabIndex={-1}
                  className="min-h-screen min-w-0 pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:pt-20 md:pb-0 print:min-h-0 print:p-0"
                >
                  {children}
                  <Suspense fallback={null}>
                    <ShellOnly>
                      <SiteFooter />
                    </ShellOnly>
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
