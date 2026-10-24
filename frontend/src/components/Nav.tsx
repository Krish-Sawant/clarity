"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Future Decision" },
  { href: "/quiz", label: "Quiz" },
  { href: "/lessons", label: "Lessons" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4">
        <span className="mr-3 py-3 font-semibold">Clarity</span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`-mb-px border-b-2 px-3 py-3 text-sm ${
              pathname === l.href ? "border-blue-600 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
