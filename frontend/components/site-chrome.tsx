import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-paper/10 bg-asphalt/80 backdrop-blur">
      <nav className="mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-3 sm:max-w-5xl sm:px-6">
        <Link href="/" className="font-display text-lg uppercase tracking-wide text-paper">
          Jalur APEXGP
        </Link>
        <Link href="/predict" className="font-mono text-xs text-paper-dim hover:text-paper">
          Predict
        </Link>
      </nav>
    </header>
  );
}
