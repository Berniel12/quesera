"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface LocationStripProps {
  displayText: string | null;
  isConfirmed: boolean;
}

const DISMISS_KEY = "quesera_location_strip_dismissed";

export function LocationStrip({ displayText, isConfirmed }: LocationStripProps) {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
  }, []);

  if (dismissed || !displayText) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  const prefix = isConfirmed ? "Personalized for" : "Showing questions relevant to";

  return (
    <div className="flex items-center justify-between gap-3 py-2 mb-4 animate-fade-in">
      <p className="text-xs text-muted-foreground">
        {prefix} {displayText}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss location suggestion"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
