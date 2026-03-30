"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  questionText: string;
  verdict: string | null;
  url?: string;
}

export function ShareButton({ questionText, verdict, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const shareText = verdict
    ? `${questionText} -- ${verdict}. See what the markets say:`
    : `${questionText} -- See what the markets say:`;

  async function handleShare() {
    // Mobile: native share sheet
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: questionText,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    // Desktop: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <Button
      onClick={handleShare}
      variant="outline"
      className="rounded-full h-10 px-5 text-xs"
    >
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
