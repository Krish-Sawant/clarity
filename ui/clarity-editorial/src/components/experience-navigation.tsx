import Link from "next/link";
import type { Section } from "../lib/types";

const links = {
  lab: [
    { href: "/future-lab", section: "future-lab", label: "Everyday paths" },
    { href: "/decisions", section: "decisions", label: "Future Decisions" },
    { href: "/calculators", section: "calculators", label: "Debt & savings" },
    { href: "/stress-test", section: "stress-test", label: "Stress test" },
    { href: "/plan-checkins", section: "plan-checkins", label: "Plan check-ins" },
  ],
  advisor: [
    { href: "/advisor", section: "advisor", label: "Possible moments" },
    { href: "/purchase-impact", section: "purchase-impact", label: "Purchase preview" },
    { href: "/loan-comfort", section: "loan-comfort", label: "Loan comfort" },
    { href: "/card-readiness", section: "card-readiness", label: "Card readiness" },
  ],
  trust: [
    { href: "/approach", section: "approach", label: "Our approach" },
    { href: "/evidence", section: "evidence", label: "Recorded evaluation" },
  ],
};

export function ExperienceNavigation({ group, active }: { group: keyof typeof links; active: Section }) {
  return <nav className="experience-navigation" aria-label={group === "lab" ? "Future Lab tools" : group === "advisor" ? "Advisor tools" : "Methods and evidence"}>{links[group].map((link) => <Link key={link.href} href={link.href} aria-current={active === link.section ? "page" : undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}</nav>;
}
