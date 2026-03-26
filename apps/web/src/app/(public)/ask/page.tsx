import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AskForm } from "./ask-form";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

export const metadata = {
  title: "Ask QUESERA",
  description: "Ask any question about what happens next. Get answers backed by prediction markets, forecasters, and real data.",
};

export default async function AskPage() {
  const supabase = await createClient();

  // Load trending questions (top by asked_count, answered only)
  const { data: trending } = await db(supabase)
    .from("oracle_queries")
    .select("question_text, question_slug, asked_count, status, matched_topic_id")
    .eq("status", "answered")
    .not("llm_verdict", "is", null)
    .order("asked_count", { ascending: false })
    .limit(6);

  const trendingQueries = (trending ?? []) as Array<{
    question_text: string;
    question_slug: string;
    asked_count: number;
  }>;

  return (
    <main className="flex-1 flex flex-col items-center px-4 pt-16 pb-24">
      <div className="w-full max-w-xl">
        {/* Header */}
        <h1 className="text-3xl font-bold tracking-tight text-center mb-2">
          Ask QUESERA
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Ask anything about what happens next. Answers backed by prediction markets and real data.
        </p>

        {/* Ask form */}
        <AskForm />

        {/* Trending questions */}
        {trendingQueries.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Trending questions
            </h2>
            <div className="space-y-2">
              {trendingQueries.map((q) => (
                <Link
                  key={q.question_slug}
                  href={`/ask/${q.question_slug}`}
                  className="block p-3 rounded-lg bg-card hover:bg-accent/50 transition-colors border border-border/50"
                >
                  <span className="text-sm font-medium">{q.question_text}</span>
                  {q.asked_count > 1 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {q.asked_count} people asked
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
