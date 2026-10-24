import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoProvider } from "../state/demo-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clarity — A little knowledge. A different future.",
  description: "Find your starting point, make financial ideas click, and explore what comes next. An independent, transparent learning demo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><body><DemoProvider>{children}</DemoProvider></body></html>;
}
