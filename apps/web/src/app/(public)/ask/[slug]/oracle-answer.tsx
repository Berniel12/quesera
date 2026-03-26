"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthPrompt } from "@/components/auth-prompt";

interface OracleAnswerProps {
  queryId: string;
  slug: string;
  status: string;
  verdict: string | null;
  sourceSignals: Array<{
    source: string;
    value: string;
    probability?: number;
    direction?: string;
    confidence?: string;
    updated_at: string;
  }> | null;
  showFallback: boolean;
  needsPolling: boolean;
  watchNext: string | null;
  topicInfo: { canonical_name: string; slug: string; category: string | null } | null;
  relatedQuestions: Array<{ question_text: string; slug: string }>;
  isLoggedIn: boolean;
  isSubscribed: boolean;
}

const CAT_GRADIENT: Record<string, string> = {
  macro: "from-blue-500/10 to-transparent",
  crypto: "from-amber-500/10 to-transparent",
  politics: "from-indigo-500/10 to-transparent",
  geopolitics: "from-red-500/10 to-transparent",
  sports: "from-emerald-500/10 to-transparent",
  disasters: "from-orange-500/10 to-transparent",
  tech: "from-violet-500/10 to-transparent",
  entertainment: "from-pink-500/10 to-transparent",
};

export function OracleAnswer({
  queryId,
  slug,
  status,
  verdict: initialVerdict,
  sourceSignals: initialSignals,
  showFallback,
  needsPolling,
  watchNext,
  topicInfo,
  relatedQuestions,
  isLoggedIn,
  isSubscribed: initialSubscribed,
}: OracleAnswerProps) {
  const [verdict, setVerdict] = useState(initialVerdict);
  const [signals, setSignals] = useState(initialSignals);
  const [polling, setPolling] = useState(needsPolling);
  const [timedOut, setTimedOut] = useState(false);
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [subscribing, setSubscribing] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const gradient = topicInfo?.category ? CAT_GRADIENT[topicInfo.category] ?? "from-primary/5 to-transparent" : "from-primary/5 to-transparent";

  // Polling for pending verdict
  const pollForVerdict = useCallback(async () => {
    try {
      const res = await fetch(`/api/ask/${slug}/poll`);
      if (!res.ok) return;
      const data = await res.json() as {
        verdict: string | null;
        source_signals: typeof initialSignals;
        synthesis_failed: boolean;
      };
      if (data.verdict) {
        setVerdict(data.verdict);
        setSignals(data.source_signals);
        setPolling(false);
      } else if (data.synthesis_failed) {
        setPolling(false);
        setTimedOut(true);
      }
    } catch {
      // Non-critical -- try again on next interval
    }
  }, [slug]);

  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(pollForVerdict, 2000);
    const timeout = setTimeout(() => {
      setPolling(false);
      setTimedOut(true);
    }, 30_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [polling, pollForVerdict]);

  async function handleSubscribe() {
    if (!isLoggedIn) {
      setShowAuthPrompt(true);
      return;
    }

    setSubscribing(true);
    try {
      const res = await fetch(`/api/ask/${slug}/subscribe`, { method: "POST" });
      if (res.ok) setSubscribed(true);
    } catch {
      // Non-critical
    } finally {
      setSubscribing(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // STATE: Insufficient data (waitlist)
  if (status === "insufficient_data") {
    return (
      <div className="animate-fade-in">
        <div className="text-center py-8">
          <p className="text-lg text-foreground mb-2">
            We're gathering signals on this one
          </p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Not enough data from prediction markets and forecasters yet. You asked -- that tells us it matters. We'll let you know when we have something.
          </p>
          {subscribed ? (
            <button
              disabled
              className="px-6 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium"
            >
              Subscribed
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              aria-label="Get notified when answer is ready"
            >
              {subscribing ? "Subscribing..." : "Notify me when ready"}
            </button>
          )}
          {!isLoggedIn && !subscribed && (
            <p className="text-xs text-muted-foreground mt-3">
              Sign in to get notified
            </p>
          )}
        </div>

        {relatedQuestions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border/50">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Related predictions people are watching
            </h3>
            <div className="space-y-2">
              {relatedQuestions.map((q) => (
                <Link
                  key={q.slug}
                  href={`/ask/${q.slug}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {q.question_text}
                </Link>
              ))}
            </div>
          </div>
        )}

        <AuthPrompt
          open={showAuthPrompt}
          onClose={() => setShowAuthPrompt(false)}
          action="get notified when this answer is ready"
        />
      </div>
    );
  }

  // STATE: Pending (skeleton while synthesis runs)
  if (polling || (status === "answered" && !verdict && !showFallback && !timedOut)) {
    return (
      <div aria-busy="true">
        <div className={`rounded-xl bg-gradient-to-br ${gradient} p-6 mb-6`}>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Oracle verdict
          </div>
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-5 w-4/5 mb-4" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // STATE: Answered (full verdict) or Fallback (synthesis failed, show raw signals)
  const showingFallback = showFallback || timedOut;

  return (
    <div className="animate-slide-up">
      {/* Verdict block */}
      <div className={`rounded-xl bg-gradient-to-br ${gradient} p-6 mb-6`}>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
          Oracle verdict
        </div>
        {verdict ? (
          <p className="text-base leading-relaxed">{verdict}</p>
        ) : showingFallback ? (
          <p className="text-sm text-muted-foreground italic">
            We have the data but the summary is still processing. Here are the raw signals below.
          </p>
        ) : null}

        {/* Probability bar (from first signal with probability) */}
        {signals && signals.some((s) => s.probability != null) && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full animate-bar-fill"
                style={{ width: `${signals.find((s) => s.probability != null)?.probability ?? 0}%` }}
                role="progressbar"
                aria-valuenow={signals.find((s) => s.probability != null)?.probability ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="text-xl font-bold tabular-nums animate-number-reveal delay-200">
              {signals.find((s) => s.probability != null)?.probability}%
            </span>
          </div>
        )}
      </div>

      {/* Source signals */}
      {signals && signals.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Source signals
          </h2>
          <div className="space-y-2">
            {signals.map((s, i) => (
              <div
                key={`${s.source}-${i}`}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border/50"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[100px]">
                  {s.source}
                </span>
                <span className="text-sm flex-1">{s.value}</span>
                {s.confidence && (
                  <span className="text-xs text-muted-foreground">{s.confidence}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* What to watch */}
      {watchNext && (
        <section className="mb-6 pt-4 border-t border-border/50">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
            What to watch
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{watchNext}</p>
        </section>
      )}

      {/* Topic link */}
      {topicInfo && (
        <div className="mb-6">
          <Link
            href={`/topics/${topicInfo.slug}`}
            className="text-xs text-primary hover:underline"
          >
            Full signal page: {topicInfo.canonical_name}
          </Link>
        </div>
      )}

      {/* Share bar */}
      <div className="flex gap-2">
        <button
          onClick={handleCopyLink}
          className="px-4 py-2 rounded-lg bg-card border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy link to answer"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
