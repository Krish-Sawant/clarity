"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../components/icon";
import { baselineQuestions, lessons } from "../data/content";
import { getRecommendedLessons, scoreAssessment } from "../lib/assessment";
import { CORE_DOMAINS, DOMAIN_LABELS } from "../lib/types";
import { useDemo } from "../state/demo-store";

function SignalArtwork() {
  return <div className="signal-art" aria-hidden="true">
    <div className="art-meta"><span>CLARITY RESEARCH / 001</span><Icon name="plus" size={15} /></div>
    <svg viewBox="0 0 520 390" className="signal-graphic" fill="none">
      <defs><linearGradient id="signal-fade" x1="80" y1="350" x2="440" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="var(--accent)" stopOpacity=".22" /><stop offset="1" stopColor="var(--accent)" /></linearGradient></defs>
      <path d="M0 195h520M260 0v390" stroke="currentColor" opacity=".12" />
      {[80, 140, 200].map((r) => <circle key={r} cx="260" cy="195" r={r} stroke="currentColor" opacity=".08" />)}
      {Array.from({ length: 26 }, (_, index) => {
        const shift = index * 6.3;
        return <path key={index} d={`M ${82 + shift * .25} ${332 - shift * .2} C ${50 + shift * 1.3} ${128 - shift * .14}, ${377 - shift * 1.15} ${350 - shift * 1.05}, ${435 - shift * .19} ${59 + shift * .29}`} stroke="url(#signal-fade)" strokeWidth="1.3" />;
      })}
      <path d="M260 184v22m-11-11h22" stroke="var(--accent)" />
      <circle cx="85" cy="330" r="5" fill="var(--accent)" /><circle cx="435" cy="59" r="5" fill="var(--accent)" />
      <text x="103" y="348" fill="currentColor" fontSize="9" letterSpacing="2">START WHERE YOU ARE</text>
      <text x="294" y="42" fill="var(--accent)" fontSize="9" letterSpacing="2">SEE WHAT’S POSSIBLE</text>
    </svg>
    <div className="art-bottom"><span>LESS NOISE.<br />MORE DIRECTION.</span><span className="art-coordinate">40.79° N<br />077.86° W</span></div>
  </div>;
}

export function OverviewView() {
  const { state, loadSample } = useDemo();
  const router = useRouter();
  const [confirmSample, setConfirmSample] = useState(false);
  const score = scoreAssessment(baselineQuestions, state.baseline.answers);
  const completedCore = lessons.filter((lesson) => lesson.domain !== "advanced" && state.completedLessons.includes(lesson.id)).length;
  const recommended = getRecommendedLessons(state.baseline.answers, state.goal).find((lesson) => !state.completedLessons.includes(lesson.id));
  const next = !state.baseline.completed ? { label: "Find my starting point", href: "/discover", detail: "Eight questions. About three minutes. A place to begin." } : completedCore < 4 ? { label: "Continue my learning", href: "/learn", detail: recommended ? `Up next: ${recommended.title}.` : "Your next lesson is ready when you are." } : !state.checkpoint.completed ? { label: "See what’s sticking", href: "/discover?tab=reassess", detail: "Try eight new questions on the same concepts." } : { label: "Explore my possibilities", href: "/future-lab", detail: "Put what you know into a possible future." };
  const steps = [
    { number: "01", title: "Discover", subtitle: "Know your starting point.", text: "A short knowledge check makes room for what you know and what’s worth exploring.", href: "/discover", icon: "sparkles", complete: state.baseline.completed, meta: state.baseline.completed ? `${score.correct} of 8 correct` : "8 questions · 3 minutes" },
    { number: "02", title: "Learn", subtitle: "Make the ideas click.", text: "Short lessons, real examples, and room to ask a question. Take it at your own pace.", href: "/learn", icon: "book", complete: completedCore >= 4, meta: `${completedCore} of 4 core lessons complete` },
    { number: "03", title: "Reassess", subtitle: "See what stays with you.", text: "New questions on familiar concepts. A thoughtful comparison with where you started.", href: "/discover?tab=reassess", icon: "chart", complete: state.checkpoint.completed, meta: state.checkpoint.completed ? "Comparison ready" : "8 matched concepts" },
  ];

  function sample() {
    if (Object.keys(state.baseline.answers).length && !confirmSample) { setConfirmSample(true); return; }
    loadSample(); router.push("/learn");
  }

  return <div className="overview-view">
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><span className="mini-cross">+</span> FINANCIAL KNOW-HOW. REAL-WORLD CONFIDENCE.</p><h1>A little <em>clarity.</em><br />A lot of<br />possibility<span className="accent-period">.</span></h1><p className="hero-description">Money makes more sense when you understand it.<br className="desktop-break" /> Find your footing. Build your knowledge.<br className="desktop-break" /> Make your next move with confidence.</p><div className="hero-actions"><Link href={next.href} className="button button--primary">{next.label}<Icon name="arrow-up-right" size={18} /></Link><button className="text-link" onClick={sample}>Explore sample journey <Icon name="arrow-right" size={16} /></button></div>{confirmSample && <div className="inline-notice sample-confirm" role="group" aria-label="Confirm loading sample"><p>Loading the sample replaces this tab’s demo progress with a synthetic profile.</p><button className="button button--secondary" onClick={sample}>Load sample profile</button><button className="button button--ghost" onClick={() => setConfirmSample(false)}>Keep my progress</button></div>}<div className="hero-footnote"><span className="tiny-dot" /> Local demo · No account or bank connection required</div></div>
      <div className="hero-visual"><SignalArtwork /><div className="visual-caption"><span>FIG. 01 — A CLEARER PERSPECTIVE</span><span>DESIGNED AROUND YOU <Icon name="plus" size={13} /></span></div></div>
    </section>

    <section className="journey-section" aria-labelledby="journey-heading"><div className="section-heading"><div className="journey-intro"><p className="eyebrow">A LITTLE UNDERSTANDING GOES A LONG WAY</p><h2 id="journey-heading">Your next chapter<br />starts with <em>you.</em></h2></div><p>Not a race. Not a test of your worth.<br />Just a clearer way forward.</p></div><div className="journey-grid">{steps.map((step) => <Link href={step.href} key={step.number} className="journey-card"><div className="journey-card__top"><span className="step-number">{step.number}</span><span className="step-symbol"><Icon name={step.complete ? "check" : step.icon} size={25} /></span></div><h3>{step.title}</h3><strong>{step.subtitle}</strong><p>{step.text}</p><div className="journey-card__bottom"><span>{step.complete && <span aria-hidden="true">✓ </span>}{step.meta}</span><Icon name="arrow-up-right" size={21} /></div></Link>)}</div></section>

    <section className="knowledge-section panel" aria-labelledby="signal-heading"><div className="knowledge-intro"><p className="eyebrow">YOUR KNOWLEDGE SIGNAL</p><h2 id="signal-heading">A starting point.<br /><em>Not a final word.</em></h2><p>{state.baseline.completed ? `${state.sampleJourney ? "The synthetic sample" : "Your demo check-in"} answered ${score.correct} of ${score.total} questions correctly. These counts guide what to explore next.` : "Your signal takes shape as you explore. Start Discover to see which concepts feel familiar and which deserve a closer look."}</p><Link href="/discover" className="text-link">{state.baseline.completed ? "Review the starting point" : "Find my signal"}<Icon name="arrow-up-right" size={16} /></Link></div><div className="knowledge-grid">{CORE_DOMAINS.map((domain, i) => <div className="knowledge-domain" key={domain}><div><span className="eyebrow">0{i + 1} / {DOMAIN_LABELS[domain]}</span><Icon name="plus" size={13} /></div><strong>{state.baseline.completed ? score.byDomain[domain].correct : "—"}<span> / 2</span></strong><span className="caption">{state.baseline.completed ? "questions correct" : "not measured yet"}</span><div className="knowledge-track"><span style={{ width: state.baseline.completed ? `${score.byDomain[domain].correct * 50}%` : "0%" }} /></div></div>)}</div></section>

    <section className="future-teaser"><div className="future-teaser__copy"><p className="eyebrow">THE FUTURE ISN’T ONE STRAIGHT LINE</p><h2>What if<br />you could <em>see it?</em></h2><p>A different rent. An unexpected bill. A little more breathing room. Explore three possible paths before you choose your next step.</p><Link href="/future-lab" className="button button--accent">Enter the Future Lab <Icon name="arrow-up-right" size={18} /></Link><span className="caption">Illustrative scenarios. Transparent assumptions. Your decisions.</span></div><div className="future-illustration" aria-hidden="true"><div className="future-chart-meta"><span className="eyebrow">THREE PATHS. ONE STARTING POINT.</span><span className="eyebrow">+ EXPLORE</span></div><svg viewBox="0 0 500 280" fill="none"><path d="M20 220h460M20 150h460M20 80h460" stroke="currentColor" opacity=".15" strokeDasharray="3 6" /><path d="m20 220 75-7 75 9 75-32 75-2 75-25 85-6" stroke="currentColor" opacity=".5" strokeWidth="1.5" /><path d="m20 220 75-24 75-15 75-23 75-31 75-33 85-38" stroke="var(--accent)" strokeWidth="2" /><path d="m20 220 75-32 75-30 75-26 75-43 75-33 85-38" stroke="currentColor" strokeWidth="1.5" /><circle cx="20" cy="220" r="5" fill="var(--accent)" /><circle cx="480" cy="56" r="5" fill="var(--accent)" /></svg><div className="future-chart-labels"><span>TODAY</span><span>POSSIBILITY →</span></div><p>Illustration only · change the inputs in Future Lab</p></div></section>

    <section className="panel advisor-teaser"><div><p className="eyebrow">A MOMENT WORTH A CLOSER LOOK</p><h2>Notice a change.<br /><em>Consider what’s next.</em></h2></div><div><p>A new paycheck. A different rent. A growing cushion. Explore possible changes in sample activity, see the evidence, and decide which ones deserve your attention.</p><Link href="/advisor" className="text-link">Meet the Advisor <Icon name="arrow-up-right" size={17} /></Link><span className="caption">Synthetic activity · transparent local rules</span></div></section>

    <section className="trust-strip"><div><Icon name="shield" size={28} /><h2>Confidence, without<br />the fine print.</h2></div><p>Know where an explanation comes from.<br />See how a number is calculated.<br />Approve every next step yourself.</p><Link href="/approach" className="text-link">Our approach <Icon name="arrow-up-right" size={17} /></Link></section>
    <div className="next-task" aria-label="Recommended next task"><span className="eyebrow">UP NEXT</span><span>{next.detail}</span><Link href={next.href} aria-label={next.label}><Icon name="arrow-right" size={19} /></Link></div>
  </div>;
}
