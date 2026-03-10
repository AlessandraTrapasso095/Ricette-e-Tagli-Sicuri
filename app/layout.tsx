import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SessionHeartbeat } from "@/components/layout/session-heartbeat";
import { defaultMetadata } from "@/config/site";

import "./globals.css";

export const metadata: Metadata = {
  title: defaultMetadata.title,
  description: defaultMetadata.description,
  icons: {
    icon: "/brand/logo-ricette-tagli-sicuri.png",
    shortcut: "/brand/logo-ricette-tagli-sicuri.png",
    apple: "/brand/logo-ricette-tagli-sicuri.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">
        <SessionHeartbeat />
        {children}
      </body>
    </html>
  );
}
