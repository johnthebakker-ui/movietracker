import Link from "next/link";
export default function NotFound() { return <main className="page"><div className="shell"><div className="empty-state"><div className="eyebrow">404</div><h2 className="display">This scene doesn’t exist.</h2><Link className="button" href="/">Return home</Link></div></div></main>; }
