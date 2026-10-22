import type { Metadata, Viewport } from "next";
import "./globals.css";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { default: `${env.appName} — sell anything from your link in bio`, template: `%s · ${env.appName}` },
  description: "A link-in-bio store for creators: digital products, courses, coaching, memberships, email automation and affiliates. 0% fees on paid plans.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
