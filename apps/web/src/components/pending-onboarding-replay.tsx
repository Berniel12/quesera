"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hasPendingOnboarding, applyPendingOnboarding } from "@/lib/onboarding";

export function PendingOnboardingReplay() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "replaying" | "done" | "partial">("idle");
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    const onboardingParam = searchParams.get("onboarding");
    const shouldReplay = onboardingParam === "pending" || hasPendingOnboarding();
    if (!shouldReplay || !hasPendingOnboarding()) return;

    let cancelled = false;

    async function replay() {
      setStatus("replaying");
      const result = await applyPendingOnboarding();
      if (cancelled) return;

      if (result.ok) {
        setStatus("done");
        // Clean up URL param without full reload
        const url = new URL(window.location.href);
        url.searchParams.delete("onboarding");
        window.history.replaceState({}, "", url.toString());
        // Reload to show followed topics
        window.location.reload();
      } else {
        setFailedCount(result.failed.length);
        setStatus("partial");
      }
    }

    replay();
    return () => { cancelled = true; };
  }, [searchParams]);

  if (status === "idle" || status === "done") return null;

  if (status === "replaying") {
    return (
      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        Setting up your feed...
      </div>
    );
  }

  if (status === "partial") {
    return (
      <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-foreground">
        {failedCount} subject{failedCount > 1 ? "s" : ""} couldn't be followed. They'll be retried on your next visit.
      </div>
    );
  }

  return null;
}
