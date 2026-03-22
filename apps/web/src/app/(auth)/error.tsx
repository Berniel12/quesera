"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-4xl py-20 text-center">
      <h2 className="text-2xl font-bold text-navy mb-4">
        Something went wrong
      </h2>
      <p className="text-muted-foreground mb-6">
        We had trouble loading your dashboard. Please try again.
      </p>
      <Button onClick={reset} className="rounded-full">
        Try Again
      </Button>
    </div>
  );
}
