import Link from "next/link";
import type { Section } from "../lib/types";

const links = {
  lab: [
    { href: "/future-lab", section: "future-lab", label: "Everyday paths" },
    { href: "/decisions", section: "decisions", label: "Future Decisions" },
    { href: "/calculators", section: "calculators", label: "Debt & savings" },
  ],
  advisor: [
    { href: "/advisor", section: "advisor", label: "Possible moments" },
    { href: "/purchase-impact", section: "purchase-impact", label: "Purchase preview" },
  ],
  trust: [
    { href: "/approach", section: "approach", label: "Our approach" },
    { href: "/evidence", section: "evidence", label: "Recorded evaluation" },
  ],
};

export function ExperienceNavigation({ group, active }: { group: keyof typeof links; active: Section }) {
  return <nav className="experience-navigation" aria-label={group === "lab" ? "Future Lab tools" : group === "advisor" ? "Advisor tools" : "Methods and evidence"}>{links[group].map((link) => <Link key={link.href} href={link.href} aria-current={active === link.section ? "page" : undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}</nav>;
}
