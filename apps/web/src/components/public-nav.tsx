import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-2xl backdrop-saturate-[180%] bg-background/80 shadow-[0_1px_30px_rgba(11,19,38,0.03)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.2)] animate-slide-down">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-extrabold tracking-[0.08em] uppercase text-foreground">
            QUESERA
          </span>
          <span className="relative ml-0.5 h-2 w-2 self-end mb-[3px]">
            <span className="absolute inset-0 rounded-full bg-positive dark:bg-[#00DAF3] animate-pulse-live" />
            <span className="relative block h-2 w-2 rounded-full bg-positive dark:bg-[#00DAF3]" />
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/search"
            className="hidden sm:flex h-11 items-center rounded-2xl bg-secondary dark:bg-[#222A3E] px-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Search
          </Link>
          <Link
            href="/login"
            className="h-11 inline-flex items-center rounded-2xl bg-navy dark:bg-[#00DAF3] px-5 text-xs font-medium text-white dark:text-[#00171B] transition-colors hover:opacity-90"
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}
