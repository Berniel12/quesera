"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface EmailCaptureProps {
  questionSlug: string;
}

export function EmailCapture({ questionSlug }: EmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setState("submitting");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("email_signups")
        .insert({ email: email.trim().toLowerCase(), question_slug: questionSlug });

      if (error) {
        // Duplicate email is fine -- treat as success
        if (error.code === "23505") {
          setState("success");
          return;
        }
        setState("error");
        return;
      }
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="py-4">
        <p className="text-sm text-muted-foreground">
          You are subscribed. We will let you know when this changes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="py-4">
      <label className="text-sm font-medium block mb-2">
        Get updates on this question
      </label>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-3 py-2.5 rounded-lg bg-secondary dark:bg-[#222A3E] border border-border/50 dark:border-[#2D3449] text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#00DAF3]/50 transition-colors"
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="px-4 py-2.5 rounded-lg bg-[#00DAF3] text-[#0B1326] text-[13px] font-semibold hover:bg-[#00DAF3]/90 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {state === "submitting" ? "..." : "Notify me"}
        </button>
      </div>
      {state === "error" && (
        <p className="text-xs text-warning dark:text-[#FF9500] mt-2">
          Something went wrong. Try again.
        </p>
      )}
    </form>
  );
}
