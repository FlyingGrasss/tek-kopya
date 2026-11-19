import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tek Kopya — Aynı görsel, tek dosya",
  description:
    "WhatsApp medya dedupe fikrinin çalışan demosu: görseller sha256 ile bir kez saklanır, mesajlar aynı dosyayı paylaşır.",
  applicationName: "Tek Kopya",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Tek Kopya",
    title: "Tek Kopya — Aynı görsel, tek dosya",
    description:
      "Görseller içerik özetiyle bir kez saklanır; sohbetler yalnızca referans tutar.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#fafaf8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
