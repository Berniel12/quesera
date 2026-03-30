"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface QuickPollProps {
  questionSlug: string;
  questionText: string;
  currentConfidence: number | null;
}

function getVoterId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("quesera_voter_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("quesera_voter_id", id);
  }
  return id;
}

interface VoteResult {
  yesCount: number;
  noCount: number;
  total: number;
  yesPct: number;
}

export function QuickPoll({ questionSlug, questionText, currentConfidence }: QuickPollProps) {
  const [myVote, setMyVote] = useState<"yes" | "no" | null>(null);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check if user already voted (on mount)
  useEffect(() => {
    async function checkExisting() {
      const voterId = getVoterId();
      if (!voterId) { setInitialized(true); return; }

      const supabase = createClient();
      const { data } = await supabase
        .from("poll_votes")
        .select("vote")
        .eq("question_slug", questionSlug)
        .eq("voter_id", voterId)
        .maybeSingle();

      if (data) {
        setMyVote((data as { vote: string }).vote as "yes" | "no");
        await loadResults();
      }
      setInitialized(true);
    }
    checkExisting();
  }, [questionSlug]);

  async function loadResults() {
    const supabase = createClient();
    const { data } = await supabase
      .from("poll_votes")
      .select("vote")
      .eq("question_slug", questionSlug);

    const votes = (data ?? []) as Array<{ vote: string }>;
    const yesCount = votes.filter((v) => v.vote === "yes").length;
    const noCount = votes.filter((v) => v.vote === "no").length;
    const total = yesCount + noCount;
    setResult({
      yesCount,
      noCount,
      total,
      yesPct: total > 0 ? Math.round((yesCount / total) * 100) : 50,
    });
  }

  async function handleVote(vote: "yes" | "no") {
    if (myVote || loading) return;
    setLoading(true);

    const voterId = getVoterId();
    const supabase = createClient();

    const { error } = await supabase.from("poll_votes").insert({
      question_slug: questionSlug,
      vote,
      voter_id: voterId,
      confidence_at_vote: currentConfidence,
    });

    if (!error || (error.code === "23505")) {
      // Success or duplicate (already voted)
      setMyVote(vote);
      await loadResults();
    }
    setLoading(false);
  }

  if (!initialized) return null;

  // Already voted: show results
  if (myVote && result) {
    return (
      <div className="py-4">
        <p className="text-xs text-muted-foreground mb-2">
          You said <span className="font-bold text-foreground">{myVote === "yes" ? "yes" : "no"}</span>. Here is what others think:
        </p>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-3 rounded-full bg-secondary dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-positive dark:bg-[#4EDEA3] transition-all duration-500"
              style={{ width: `${result.yesPct}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-positive dark:text-[#4EDEA3] font-bold">{result.yesPct}% yes</span>
          <span className="text-muted-foreground">{result.total} {result.total === 1 ? "vote" : "votes"}</span>
          <span className="text-destructive font-bold">{100 - result.yesPct}% no</span>
        </div>
        <Link href="/my-calls" className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground mt-2 block transition-colors">
          See all your calls
        </Link>
      </div>
    );
  }

  // Not voted: show buttons
  return (
    <div className="py-4">
      <p className="text-sm font-medium mb-3">What do you think?</p>
      <div className="flex gap-2">
        <button
          onClick={() => handleVote("yes")}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg border border-positive/30 dark:border-[#4EDEA3]/30 text-sm font-semibold text-positive dark:text-[#4EDEA3] hover:bg-positive/10 dark:hover:bg-[#4EDEA3]/10 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Yes"}
        </button>
        <button
          onClick={() => handleVote("no")}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "No"}
        </button>
      </div>
    </div>
  );
}
