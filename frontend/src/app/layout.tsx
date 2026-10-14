import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";

import { CommandPalette } from "@/components/shell/command-palette";
import { Toolbar } from "@/components/shell/toolbar";
import { MotionProvider } from "@/components/motion-provider";
import { AppProvider } from "@/components/providers";
import { Sidebar } from "@/components/shell/sidebar";

import { PrefsProvider, THEME_INIT_SCRIPT } from "@/lib/prefs";

import "./globals.css";

export const metadata: Metadata = {
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
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <PrefsProvider>
          <AppProvider>
            <MotionProvider>
              <CommandPalette>
                <div className="flex min-h-screen">
                  {/* usePathname() en rutas dinámicas (/envios/[code]) exige un límite de Suspense */}
                  <Suspense fallback={<aside className="hidden w-60 shrink-0 border-r border-border md:block" aria-hidden />}>
                    <Sidebar />
                  </Suspense>
                  <div className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
                    <Toolbar />
                    <main className="min-w-0 flex-1">{children}</main>
                  </div>
                </div>
              </CommandPalette>
            </MotionProvider>
          </AppProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
