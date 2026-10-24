import type { CSSProperties } from "react";

const paths: Record<string, React.ReactNode> = {
  "arrow-up-right": <path d="M5 19 19 5M5 5h14v14" />,
  "arrow-right": <path d="M4 12h16m-7-7 7 7-7 7" />,
  "arrow-left": <path d="M20 12H4m7-7-7 7 7 7" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  minus: <path d="M4 12h16" />,
  menu: <path d="M4 8h16M4 16h16" />,
  sliders: <><path d="M4 6h7m5 0h4M4 18h3m5 0h8M4 12h2m5 0h9" /><path d="M11 3v6M7 15v6M6 9v6" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z" /></>,
  chart: <><path d="M4 3v17h17M7 14l4-5 4 3 5-7" /></>,
  book: <><path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3V4ZM12 6v15" /></>,
  external: <><path d="M14 3h7v7m0-7L10 14M9 3H3v18h18v-6" /></>,
  refresh: <><path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="1" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
};

export function Icon({ name, size = 20, className, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" className={className} style={style}>{paths[name] ?? paths["arrow-up-right"]}</svg>;
}
