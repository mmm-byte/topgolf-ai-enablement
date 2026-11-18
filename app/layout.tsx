import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "./fonts/Inter-Variable-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
});

const mono = localFont({
  src: "./fonts/JetBrainsMono-Variable-latin.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 800",
  fallback: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://topgolf-ai-enablement.vercel.app"),
  title: {
    default: "AI Enablement Engineering | Topgolf AI-SDLC Pipeline",
    template: "%s | Topgolf AI-SDLC Pipeline",
  },
  description:
    "Archetypes, governed connectors, guardrail hooks and drift monitoring for a gated AI-SDLC pipeline. An independent portfolio project built for the Topgolf AI Enablement Engineer role (JR2023-23049).",
  applicationName: "Topgolf AI-SDLC Pipeline",
  keywords: [
    "AI enablement",
    "AI-SDLC",
    "archetypes",
    "SKILL.md",
    "MCP",
    "Model Context Protocol",
    "guardrails",
    "drift monitoring",
    "Topgolf",
  ],
  authors: [{ name: "Topgolf AI Enablement Portfolio" }],
  openGraph: {
    type: "website",
    title: "AI Enablement Engineering | Topgolf AI-SDLC Pipeline",
    description:
      "Executable archetypes, governed MCP connectors, deterministic guardrails and drift monitoring for a gated AI-SDLC pipeline.",
    siteName: "Topgolf AI-SDLC Pipeline",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Enablement Engineering | Topgolf AI-SDLC Pipeline",
    description:
      "Executable archetypes, governed MCP connectors, deterministic guardrails and drift monitoring for a gated AI-SDLC pipeline.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b1016",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
