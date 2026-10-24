import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><p className="eyebrow">CLARITY / 404</p><h1>A different<br />direction.</h1><p>This page isn’t part of the journey.</p><Link href="/" className="button button--primary">Back to Clarity ↗</Link></main>;
}
