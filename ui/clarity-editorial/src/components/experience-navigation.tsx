import Link from "next/link";

// Sub-navigation for sections that group several tools. `id` is matched against `active`:
// a section name for the page-level groups, a tab name for the in-page tab groups.
const links = {
  lab: [
    { href: "/future-lab", id: "future-lab", label: "Explore your tomorrow" },
    { href: "/decisions", id: "decisions", label: "Future Decisions" },
    { href: "/calculators", id: "calculators", label: "Debt & savings" },
  ],
  advisor: [
    { href: "/advisor", id: "advisor", label: "Possible moments" },
    { href: "/before-you-commit", id: "before-you-commit", label: "Before you commit" },
  ],
  commit: [
    { href: "/before-you-commit", id: "purchase", label: "Purchase preview" },
    { href: "/before-you-commit?tab=loan", id: "loan", label: "Loan comfort" },
    { href: "/before-you-commit?tab=card", id: "card", label: "Card readiness" },
  ],
  assessment: [
    { href: "/discover", id: "baseline", label: "Starting point" },
    { href: "/discover?tab=reassess", id: "reassess", label: "Reassess" },
  ],
};

const labels: Record<keyof typeof links, string> = { lab: "Future Lab tools", advisor: "Advisor tools", commit: "Commitment checks", assessment: "Knowledge checks" };

export function ExperienceNavigation({ group, active }: { group: keyof typeof links; active: string }) {
  return <nav className="experience-navigation" aria-label={labels[group]}>{links[group].map((link) => <Link key={link.href} href={link.href} aria-current={active === link.id ? "page" : undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}</nav>;
}
