"use client";

import { lazy, Suspense } from "react";

const Client = lazy(() => import("./sources-client"));

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading...</div>}>
      <Client />
    </Suspense>
  );
}
