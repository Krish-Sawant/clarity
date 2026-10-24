"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Section } from "../lib/types";
import { useDemo } from "../state/demo-store";
import { useDesign } from "../state/design-store";
import { OverviewView } from "../views/overview";
import { AssessmentView } from "../views/assessment";
import { LearningView } from "../views/learning";
import { FutureLabView } from "../views/future-lab";
import { ApproachView } from "../views/approach";
import { DesignControls } from "./design-controls";
import { Icon } from "./icon";

const navigation: { section: Section; href: string; label: string; number?: string }[] = [
  { section: "overview", href: "/", label: "Overview" },
  { section: "discover", href: "/discover", label: "Discover", number: "01" },
  { section: "learn", href: "/learn", label: "Learn", number: "02" },
  { section: "reassess", href: "/reassess", label: "Reassess", number: "03" },
  { section: "future-lab", href: "/future-lab", label: "Future Lab" },
  { section: "approach", href: "/approach", label: "Our approach" },
];

function Brand() {
  return <><svg viewBox="0 0 32 32" width="31" height="31" fill="currentColor" aria-hidden="true"><path d="m16 1 4.1 10.9L31 16l-10.9 4.1L16 31l-4.1-10.9L1 16l10.9-4.1L16 1Z" /><path d="M6 6h20v20H6z" opacity=".22" /></svg><span>clarity<span className="brand-dot">®</span></span></>;
}

export function ClarityApp({ section }: { section: Section }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const design = useDesign();
  const { state, hydrated, storageAvailable } = useDemo();
  const menuButton = useRef<HTMLButtonElement>(null);
  const style = { "--radius": `${design.radius}px`, "--panel-shadow": design.elevation === "lifted" ? "0 9px 22px #13161114" : design.elevation === "soft" ? "0 3px 10px #1316110b" : "none" } as CSSProperties;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);

  return <div className={`clarity-app palette-${design.palette}`} style={style} data-hydrated={hydrated}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="edition-bar"><span>A CLEARER RELATIONSHIP WITH MONEY.</span><span>INDEPENDENT THINKING / EDITION 02</span><span className="mode-indicator"><span /> LOCAL DEMO</span></div>
    <header className="site-header"><div className="header-main"><Link href="/" className="brand" aria-label="Clarity home"><Brand /></Link><span className="brand-description">A little knowledge.<br />A different future.</span><div className="header-actions"><button className="icon-button design-trigger" aria-label="Design settings" onClick={() => setDesignOpen(true)}><Icon name="sliders" size={19} /><span>Design studio</span></button><Link href={state.baseline.completed ? "/learn" : "/discover"} className="header-cta">Your next chapter <Icon name="arrow-up-right" size={17} /></Link><button ref={menuButton} className="icon-button menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={23} /></button></div></div><nav id="primary-navigation" className={`primary-navigation ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">{navigation.map((item) => <Link key={item.section} href={item.href} className={section === item.section ? "is-active" : ""} aria-current={section === item.section ? "page" : undefined} onClick={() => setMenuOpen(false)}>{item.number && <span className="nav-number">{item.number}</span>}{item.label}{section === item.section && <span className="nav-active-dot" />}</Link>)}<span className="nav-end">UNDERSTAND. THEN DECIDE.<Icon name="plus" size={13} /></span></nav></header>
    <div className="experience-mode"><span><span className="tiny-dot" /> {state.sampleJourney ? "SYNTHETIC SAMPLE JOURNEY" : "YOUR LOCAL EXPLORATION"}</span><Link href="/approach#connections-title">Sample data. Transparent methods.<Icon name="arrow-up-right" size={12} /></Link></div>
    {!storageAvailable && <p className="storage-notice" role="status">Browser storage is unavailable. Your demo works for this visit; progress may be lost on refresh.</p>}
    <main id="main-content" className="main-content" tabIndex={-1}>
      {section === "overview" && <OverviewView />}
      {section === "discover" && <AssessmentView stage="baseline" />}
      {section === "learn" && <LearningView />}
      {section === "reassess" && <AssessmentView stage="checkpoint" />}
      {section === "future-lab" && <FutureLabView />}
      {section === "approach" && <ApproachView />}
    </main>
    <footer className="site-footer"><div className="footer-top"><Link href="/" className="brand" aria-label="Clarity home"><Brand /></Link><p>Less noise.<br />More understanding.</p><Link href="/approach" className="text-link">Built on transparency <Icon name="arrow-up-right" size={16} /></Link></div><div className="footer-bottom"><span>CLARITY / FINANCIAL LEARNING, IN FOCUS.</span><span>Educational demo · Not personal financial advice</span><button onClick={() => setDesignOpen(true)}>MAKE IT YOURS <Icon name="sliders" size={13} /></button></div></footer>
    <DesignControls open={designOpen} onClose={() => setDesignOpen(false)} />
  </div>;
}
