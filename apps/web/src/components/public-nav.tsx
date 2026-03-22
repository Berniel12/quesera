import Link from "next/link";

export function PublicNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl backdrop-saturate-[180%] bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-2 w-8 rounded-full bg-navy" />
          <span className="text-lg font-bold tracking-tight text-navy">
            QUESERA
          </span>
        </Link>

        <div className="hidden sm:block flex-1 max-w-md mx-8">
          <Link
            href="/search"
            className="flex h-10 w-full items-center rounded-full border border-border bg-secondary/50 px-4 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            Search topics...
          </Link>
        </div>

        <Link
          href="/login"
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign In
        </Link>
      </div>
    </nav>
  );
}
