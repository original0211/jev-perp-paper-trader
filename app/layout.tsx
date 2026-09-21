import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jev Perp Paper Trader",
  description: "Simulation-only crypto perpetuals paper trading dashboard routed through Jev",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
