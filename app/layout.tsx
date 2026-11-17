import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Enablement Engineering | Topgolf AI-SDLC Pipeline",
  description:
    "Archetypes, governed connectors, guardrail hooks and drift monitoring for a gated AI-SDLC pipeline. An independent portfolio project built for the Topgolf AI Enablement Engineer role (JR2023-23049).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
