"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface PollVote {
  question_slug: string;
  vote: string;
  confidence_at_vote: number | null;
  created_at: string;
}

interface QuestionCard {
  slug: string;
  question_text: string;
  category: string | null;
  confidence: number | null;
  direction: string | null;
}

interface CallDisplay {
  slug: string;
  questionText: string;
  category: string | null;
  yourVote: "yes" | "no";
  votedAt: string;
  confidenceWhenVoted: number | null;
  currentConfidence: number | null;
  currentDirection: string | null;
}

const CAT_COLORS: Record<string, string> = {
  macro: "text-blue-400", crypto: "text-amber-400", politics: "text-indigo-400",
  geopolitics: "text-red-400", sports: "text-emerald-400", tech: "text-violet-400",
  entertainment: "text-pink-400", disasters: "text-orange-400",
};

function getVoterId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("quesera_voter_id") ?? "";
}

function timeAgo(dateStr: string): string {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function getCallStatus(call: CallDisplay): { label: string; color: string } {
  if (call.currentConfidence === null) return { label: "Pending", color: "text-muted-foreground" };

  const marketSaysYes = call.currentDirection === "up" || (call.currentConfidence > 0.5);
  const youSaidYes = call.yourVote === "yes";

  if (marketSaysYes === youSaidYes) {
    return { label: "With the market", color: "text-positive dark:text-[#4EDEA3]" };
  }
  return { label: "Against the market", color: "text-amber-500" };
}

export default function MyCallsPage() {
  const [calls, setCalls] = useState<CallDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCalls() {
      const voterId = getVoterId();
      if (!voterId) { setLoading(false); return; }

      const supabase = createClient();

      // Load all votes by this voter
      const { data: votes } = await supabase
        .from("poll_votes")
        .select("question_slug, vote, confidence_at_vote, created_at")
        .eq("voter_id", voterId)
        .order("created_at", { ascending: false });

      if (!votes || votes.length === 0) { setLoading(false); return; }

      const typedVotes = votes as PollVote[];
      const slugs = typedVotes.map((v) => v.question_slug);

      // Load current question data
      const { data: questions } = await supabase
        .from("questions")
        .select("slug, question_text, category")
        .in("slug", slugs);

      const questionMap = new Map(
        ((questions ?? []) as QuestionCard[]).map((q) => [q.slug, q]),
      );

      // Load current card data for confidence
      const { data: cards } = await supabase
        .from("public_topic_cards")
        .select("slug, confidence, direction")
        .in("slug", slugs);

      const cardMap = new Map(
        ((cards ?? []) as Array<{ slug: string; confidence: number | null; direction: string | null }>).map((c) => [c.slug, c]),
      );

      const callDisplays: CallDisplay[] = typedVotes
        .map((v) => {
          const q = questionMap.get(v.question_slug);
          const card = cardMap.get(v.question_slug);
          if (!q) return null;
          return {
            slug: v.question_slug,
            questionText: q.question_text,
            category: q.category,
            yourVote: v.vote as "yes" | "no",
            votedAt: v.created_at,
            confidenceWhenVoted: v.confidence_at_vote,
            currentConfidence: card?.confidence ?? null,
            currentDirection: card?.direction ?? null,
          };
        })
        .filter((c): c is CallDisplay => c !== null);

      setCalls(callDisplays);
      setLoading(false);
    }
    loadCalls();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[640px] px-4 sm:px-6 py-12 text-center">
        <p className="text-muted-foreground">Loading your calls...</p>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="mx-auto max-w-[640px] px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight mb-4">My Calls</h1>
        <p className="text-muted-foreground mb-6">
          You have not made any predictions yet. Visit a question page and tap Yes or No to make your first call.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-colors"
        >
          Browse questions
        </Link>
      </div>
    );
  }

  const withMarket = calls.filter((c) => getCallStatus(c).label === "With the market").length;
  const againstMarket = calls.length - withMarket;

  return (
    <div className="mx-auto max-w-[640px] px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">My Calls</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {calls.length} {calls.length === 1 ? "prediction" : "predictions"} made.{" "}
        {withMarket > 0 && <span className="text-positive dark:text-[#4EDEA3]">{withMarket} with the market</span>}
        {withMarket > 0 && againstMarket > 0 && ", "}
        {againstMarket > 0 && <span className="text-amber-500">{againstMarket} against</span>}
        .
      </p>

      <div className="space-y-3">
        {calls.map((call) => {
          const status = getCallStatus(call);
          const catColor = CAT_COLORS[call.category ?? ""] ?? "text-muted-foreground";

          return (
            <Link key={call.slug} href={`/questions/${call.slug}`}>
              <div className="p-4 rounded-xl bg-card border border-border/30 hover:border-border/50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${catColor}`}>
                    {call.category ?? "Signal"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(call.votedAt)}</span>
                </div>
                <p className="text-sm font-semibold leading-snug mb-2">{call.questionText}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${call.yourVote === "yes" ? "text-positive dark:text-[#4EDEA3]" : "text-destructive"}`}>
                      You said {call.yourVote}
                    </span>
                    <span className={`text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  {call.currentConfidence !== null && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Market: {Math.round(call.currentConfidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
