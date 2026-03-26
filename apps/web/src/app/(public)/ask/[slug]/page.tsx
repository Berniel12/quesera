import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OracleAnswer } from "./oracle-answer";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

interface OraclePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: OraclePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await db(supabase)
    .from("oracle_queries")
    .select("question_text, llm_verdict, status")
    .eq("question_slug", slug)
    .maybeSingle();

  const q = data as { question_text: string; llm_verdict: string | null; status: string } | null;
  if (!q) return { title: "QUESERA" };

  return {
    title: `${q.question_text} -- QUESERA`,
    description: q.llm_verdict ?? "QUESERA is gathering signals on this question.",
    openGraph: {
      title: q.question_text,
      description: q.llm_verdict ?? "QUESERA is gathering signals on this question.",
      siteName: "QUESERA",
    },
    twitter: {
      card: "summary_large_image",
      title: q.question_text,
      description: q.llm_verdict ?? "QUESERA is gathering signals on this question.",
    },
  };
}

export default async function OracleAnswerPage({ params }: OraclePageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Load the oracle query
  const { data } = await db(supabase)
    .from("oracle_queries")
    .select("id, question_text, question_slug, matched_topic_id, status, llm_verdict, source_signals, synthesis_failed_at, answer_snapshot_id, created_at")
    .eq("question_slug", slug)
    .maybeSingle();

  if (!data) notFound();

  const query = data as {
    id: string;
    question_text: string;
    question_slug: string;
    matched_topic_id: string | null;
    status: string;
    llm_verdict: string | null;
    source_signals: Array<{ source: string; value: string; probability?: number; direction?: string; confidence?: string; updated_at: string }> | null;
    synthesis_failed_at: string | null;
    answer_snapshot_id: string | null;
    created_at: string;
  };

  // Load matched topic info if available
  let topicInfo: { canonical_name: string; slug: string; category: string | null } | null = null;
  let watchNext: string | null = null;

  if (query.matched_topic_id) {
    const { data: topic } = await supabase
      .from("topics")
      .select("canonical_name, slug, category")
      .eq("id", query.matched_topic_id)
      .maybeSingle();
    topicInfo = topic as typeof topicInfo;

    // Get watch_next from the snapshot
    if (query.answer_snapshot_id) {
      const { data: snap } = await supabase
        .from("topic_snapshots")
        .select("what_next_text, direction, confidence")
        .eq("id", query.answer_snapshot_id)
        .maybeSingle();
      const s = snap as { what_next_text: string | null; direction: string; confidence: number } | null;
      watchNext = s?.what_next_text ?? null;
    }
  }

  // Load related predictions for insufficient_data state
  let relatedQuestions: Array<{ question_text: string; slug: string }> = [];
  if (query.status === "insufficient_data") {
    const { data: related } = await db(supabase)
      .from("oracle_queries")
      .select("question_text, question_slug")
      .eq("status", "answered")
      .not("llm_verdict", "is", null)
      .order("asked_count", { ascending: false })
      .limit(3);

    relatedQuestions = ((related ?? []) as Array<{ question_text: string; question_slug: string }>).map((r) => ({
      question_text: r.question_text,
      slug: r.question_slug,
    }));
  }

  // Check if user is subscribed (if authed)
  const { data: { user } } = await supabase.auth.getUser();
  let isSubscribed = false;
  if (user) {
    const { data: sub } = await db(supabase)
      .from("oracle_query_subscribers")
      .select("id")
      .eq("query_id", query.id)
      .eq("user_id", user.id)
      .maybeSingle();
    isSubscribed = !!sub;
  }

  // Determine render state
  const needsPolling = query.status === "answered" && !query.llm_verdict && !query.synthesis_failed_at;
  const showFallback = query.synthesis_failed_at !== null;

  return (
    <main className="flex-1 px-4 pt-8 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Conversion bar for shared links */}
        <div className="mb-6 text-center">
          <span className="text-xs text-muted-foreground">
            Asked on QUESERA.{" "}
            <Link href="/ask" className="text-primary hover:underline">
              Have your own question?
            </Link>
          </span>
        </div>

        {/* The question */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
          {query.question_text}
        </h1>

        <OracleAnswer
          queryId={query.id}
          slug={query.question_slug}
          status={query.status}
          verdict={query.llm_verdict}
          sourceSignals={query.source_signals}
          showFallback={showFallback}
          needsPolling={needsPolling}
          watchNext={watchNext}
          topicInfo={topicInfo}
          relatedQuestions={relatedQuestions}
          isLoggedIn={!!user}
          isSubscribed={isSubscribed}
        />
      </div>
    </main>
  );
}
