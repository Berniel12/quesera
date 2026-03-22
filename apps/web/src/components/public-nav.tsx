import Link from "next/link";

export function PublicNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl backdrop-saturate-[180%] bg-background/70 animate-slide-down">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-0.5">
          <span className="text-base font-extrabold tracking-tight text-navy">
            QUESERA
          </span>
          <span className="text-base font-extrabold text-navy ml-0.5">.</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="hidden sm:flex h-9 items-center rounded-2xl border border-border/60 bg-card px-4 text-xs text-muted-foreground transition-colors hover:border-navy/20"
          >
            Search
          </Link>
          <Link
            href="/login"
            className="h-9 inline-flex items-center rounded-2xl bg-navy px-5 text-xs font-medium text-white transition-colors hover:bg-navy/90"
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}
