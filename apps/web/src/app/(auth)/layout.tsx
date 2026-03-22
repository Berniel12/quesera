export const dynamic = "force-dynamic";

import Link from "next/link";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl backdrop-saturate-[180%] bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-2 w-8 rounded-full bg-navy" />
            <span className="text-lg font-bold tracking-tight text-navy">
              QUESERA
            </span>
          </Link>

          <Link
            href="/search"
            className="hidden sm:flex h-10 flex-1 max-w-md mx-8 items-center rounded-full border border-border bg-secondary/50 px-4 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            Search topics...
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">My Account</span>
          </div>
        </div>
      </nav>
      <div className="flex flex-1">
        <DashboardSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  );
}
