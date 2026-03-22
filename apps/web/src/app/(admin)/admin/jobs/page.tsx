"use client";

import { lazy, Suspense } from "react";

const Client = lazy(() => import("./jobs-client"));

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <Client />
    </Suspense>
  );
}
