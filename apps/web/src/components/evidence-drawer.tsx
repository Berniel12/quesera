"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface EvidenceItem {
  id: string;
  source_key: string;
  source_item_type: string | null;
  external_id: string;
  normalized_payload: Record<string, unknown>;
  occurred_at: string | null;
}

interface EvidenceDrawerProps {
  topicId: string;
}

export function EvidenceDrawer({ topicId }: EvidenceDrawerProps) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadEvidence() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/topics/${topicId}/evidence`);
      if (res.ok) {
        const data = (await res.json()) as { items: EvidenceItem[] };
        setItems(data.items);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  return (
    <Sheet onOpenChange={(open) => { if (open) loadEvidence(); }}>
      <SheetTrigger className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium transition-colors hover:bg-secondary">
        See all news and data
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recent News and Data</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {loading && (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-b border-border/40 pb-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </>
          )}

          {!loading && items.length === 0 && loaded && (
            <p className="text-sm text-muted-foreground">
              No source evidence available for this topic yet.
            </p>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="border-b border-border/40 pb-4 last:border-0"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.source_key}
                </span>
                {item.occurred_at && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(item.occurred_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm">
                {extractTitle(item)}
              </p>
              {item.source_item_type && (
                <span className="text-xs text-muted-foreground">
                  {item.source_item_type}
                </span>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function extractTitle(item: EvidenceItem): string {
  const p = item.normalized_payload;
  if (p.title) return String(p.title);
  if (p.headline) return String(p.headline);
  if (p.place) return String(p.place);
  if (p.series_id) return `${p.series_id}: ${p.value}`;
  if (p.event_type) return `${p.event_type} - ${p.area_desc ?? ""}`;
  return item.external_id;
}
