"use client";


import { useState, useEffect, useCallback } from "react";
import { TopicCard } from "@/components/topic-card";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  slug: string;
  canonical_name: string;
  question_text?: string | null;
  category: string | null;
  one_liner?: string | null;
  direction?: string | null;
  confidence?: number | null;
  freshness?: string | null;
  score: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results: SearchResult[] };
      setResults(data.results);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-navy mb-6">
        Ask a Question
      </h1>

      <Input
        type="text"
        placeholder="What do you want to know?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 rounded-full border-border bg-card px-6 text-base focus-visible:ring-navy"
        autoFocus
      />

      <div className="mt-8">
        {loading && (
          <p className="text-sm text-muted-foreground">Searching...</p>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <p className="text-2xl font-bold text-navy mb-2">
              Good question.
            </p>
            <p className="text-muted-foreground mb-8">
              We don&apos;t have signals on this yet, but we can start watching.
            </p>
            <SubjectRequest query={query} />
          </div>
        )}

        {results.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((r) => (
              <TopicCard
                key={r.id}
                slug={r.slug}
                canonicalName={r.question_text ?? r.canonical_name}
                category={r.category}
                direction={r.direction ?? null}
                confidence={r.confidence ?? null}
                freshness={r.freshness ?? null}
                oneLiner={r.one_liner ?? null}
              />
            ))}
          </div>
        )}

        {!searched && !loading && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ask anything. We&apos;ll show you what the signals say.
          </p>
        )}
      </div>
    </div>
  );
}

function SubjectRequest({ query }: { query: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("");

  async function handleRequest() {
    setSubmitting(true);
    try {
      await fetch("/api/topics/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: query,
          category: category || undefined,
        }),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl border border-positive/30 bg-positive/5 p-6 max-w-md mx-auto animate-scale-in">
        <p className="font-medium text-navy mb-1">We heard you.</p>
        <p className="text-sm text-muted-foreground">
          We&apos;re building signals for &ldquo;{query}&rdquo;. We&apos;ll let you know when it&apos;s ready.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-3">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-full border border-border bg-card px-4 py-2 text-sm"
      >
        <option value="">What area is this about? (optional)</option>
        <option value="politics">Politics</option>
        <option value="macro">Money & Economy</option>
        <option value="geopolitics">World & Geopolitics</option>
        <option value="disasters">Weather & Safety</option>
        <option value="crypto">Crypto</option>
        <option value="sports">Sports</option>
        <option value="tech">Tech & AI</option>
      </select>
      <button
        onClick={handleRequest}
        disabled={submitting}
        className="w-full rounded-full bg-navy text-white h-11 text-sm font-medium transition-all hover:bg-navy/90 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
      >
        {submitting ? "Sending..." : "Ask this question"}
      </button>
    </div>
  );
}
