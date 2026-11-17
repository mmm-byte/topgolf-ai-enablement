import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FIELDIQ | Enterprise Operations Intelligence",
  description: "An interactive operations intelligence product demo with guided service, parts, and fleet playbooks, scenario planning, governed metrics, and explainable decisions using synthetic data."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
