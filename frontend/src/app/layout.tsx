import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
