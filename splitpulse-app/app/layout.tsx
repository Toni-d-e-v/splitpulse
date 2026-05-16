import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SPLIT PULSE — live heat map of the city",
  description:
    "A live heat map of the city powered by GPS-based disappearing Instants.",
  applicationName: "SPLIT PULSE",
};

export const viewport: Viewport = {
  themeColor: "#0a0a1a",
  width: "device-width",
  initialScale: 1,
  // Lock browser zoom on the UI. Mapbox has its own pinch handler inside
  // the map canvas, so users can still zoom the map — but the chrome
  // (search bar, bottom sheet, etc.) no longer zooms accidentally while
  // typing or closing panels.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full app-shell">
        <RealtimeProvider>{children}</RealtimeProvider>
      </body>
    </html>
  );
}
