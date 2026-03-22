export const dynamic = "force-dynamic";

import { PublicNav } from "@/components/public-nav";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          QUESERA - Que Sera, Sera
        </div>
      </footer>
    </>
  );
}
