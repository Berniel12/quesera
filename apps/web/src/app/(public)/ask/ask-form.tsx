"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AskForm() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      const data = await res.json() as { slug: string };
      router.push(`/ask/${data.slug}`);
    } catch {
      setError("Something broke -- try again");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        aria-label="Ask QUESERA"
        placeholder="Ask anything about what happens next..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={500}
        className="w-full px-5 py-4 rounded-xl bg-card border border-border/60 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !question.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 transition-opacity"
      >
        {loading ? "Asking..." : "Ask"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </form>
  );
}
