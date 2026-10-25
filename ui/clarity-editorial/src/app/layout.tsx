import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoProvider } from "../state/demo-store";
import "./globals.css";

// Authentication must be evaluated per request, including builds without secrets.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clarity — A little knowledge. A different future.",
  description: "Find your starting point, make financial ideas click, and explore what comes next. An independent, transparent learning demo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><body><DemoProvider>{children}</DemoProvider></body></html>;
}
