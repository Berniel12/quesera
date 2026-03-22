"use client";

import { lazy, Suspense } from "react";

const Client = lazy(() => import("./search-client"));

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <Client />
    </Suspense>
  );
}
