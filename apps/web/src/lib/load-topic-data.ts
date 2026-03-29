/**
 * Shared data loader for topic/question pages.
 * Extracts the data-fetching logic so both /topics/[slug] and
 * /questions/[slug] can load the same data without duplication.
 */

import { createClient } from "@/lib/supabase/server";
import { getAnswerState } from "@/lib/answer-state";
import { getTeamEntity, getCompetitionAnswer, getTopicLogo } from "@/lib/team-entities";
import { getTopicImage } from "@/lib/topic-images";
import { getContract, filterSignalsByContract, isPublishable } from "@/lib/question-contracts";
import type { QuestionType } from "@/lib/question-contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TemplateProps,
  TemplateSignal,
  TemplateSnapshot,
  HistoryEntry,
  EvidenceItem,
  RelatedQuestion,
  CategoryStyle,
} from "@/components/templates/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

const SOURCE_LABELS: Record<string, string> = {
  fred: "Federal Reserve Economic Data", bls: "Bureau of Labor Statistics",
  eia: "Energy Information Administration", polymarket: "Polymarket",
  kalshi: "Kalshi", metaculus: "Metaculus", manifold: "Manifold Markets",
  coingecko: "CoinGecko", usgs_earthquakes: "US Geological Survey",
  noaa_nws: "National Weather Service", congress_gov: "US Congress",
  the_odds_api: "Bookmaker Consensus", espn: "ESPN", defillama: "DeFi Llama",
};

const CAT_STYLE: Record<string, CategoryStyle> = {
  macro:         { accent: "text-blue-600 dark:text-blue-400",    border: "border-blue-500/20",    bg: "from-blue-500/5 to-transparent dark:from-blue-500/10 dark:to-transparent" },
  crypto:        { accent: "text-amber-600 dark:text-amber-400",  border: "border-amber-500/20",   bg: "from-amber-500/5 to-transparent dark:from-amber-500/10 dark:to-transparent" },
  politics:      { accent: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20", bg: "from-indigo-500/5 to-transparent dark:from-indigo-500/10 dark:to-transparent" },
  geopolitics:   { accent: "text-red-600 dark:text-red-400",      border: "border-red-500/20",     bg: "from-red-500/5 to-transparent dark:from-red-500/10 dark:to-transparent" },
  sports:        { accent: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", bg: "from-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:to-transparent" },
  disasters:     { accent: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20",  bg: "from-orange-500/5 to-transparent dark:from-orange-500/10 dark:to-transparent" },
  tech:          { accent: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20",  bg: "from-violet-500/5 to-transparent dark:from-violet-500/10 dark:to-transparent" },
  entertainment: { accent: "text-pink-600 dark:text-pink-400",    border: "border-pink-500/20",    bg: "from-pink-500/5 to-transparent dark:from-pink-500/10 dark:to-transparent" },
};
const DEFAULT_STYLE: CategoryStyle = { accent: "text-muted-foreground", border: "border-border/20", bg: "from-muted/10 to-transparent" };

export { CAT_STYLE, DEFAULT_STYLE, SOURCE_LABELS };

export interface LoadResult {
  props: TemplateProps;
  pagePublishable: boolean;
}

/**
 * Load all data needed to render a question page.
 * Called with a topic ID and question metadata.
 */
export async function loadTopicData(opts: {
  topicId: string;
  topicSlug: string;
  topicCategory: string | null;
  topicCanonicalName: string;
  topicDescription: string | null;
  questionId: string;
  questionText: string;
  questionSlug: string;
  questionType: QuestionType | null;
  questionCategory: string | null;
}): Promise<LoadResult> {
  const supabase = await createClient();
  const {
    topicId, topicSlug, topicCategory, topicCanonicalName, topicDescription,
    questionId, questionText, questionSlug, questionType, questionCategory,
  } = opts;

  const catStyle = topicCategory ? (CAT_STYLE[topicCategory] ?? DEFAULT_STYLE) : DEFAULT_STYLE;

  // Competition answer from static map
  const contract = getContract(
    { question_text: questionText, question_type: questionType },
    { slug: topicSlug, category: topicCategory },
  );
  const competitionAnswer = contract.questionType === "competition" ? getCompetitionAnswer(topicSlug) : null;
  const teamEntity = competitionAnswer ? null : getTeamEntity(questionText);
  const topicLogo = getTopicLogo(topicSlug);
  const heroImage = getTopicImage(topicSlug, topicCategory);

  // Latest snapshot
  const { data: latestPointer } = await supabase.from("topic_latest_snapshot").select("snapshot_id").eq("topic_id", topicId).single();
  const snapshotId = (latestPointer as { snapshot_id: string } | null)?.snapshot_id;

  let snapshot: TemplateSnapshot | null = null;
  if (snapshotId) {
    const { data } = await supabase.from("topic_snapshots")
      .select("direction, confidence, disagreement, freshness, staleness_seconds, current_picture_text, what_changed_text, what_next_text, structured_data, published_at, version, synthesis_json")
      .eq("id", snapshotId).single();
    snapshot = data as TemplateSnapshot | null;
  }

  // Previous snapshot (for change detection)
  let prevSnapshot: { direction: string; confidence: number } | null = null;
  const { data: prevArr } = await supabase.from("topic_snapshots")
    .select("direction, confidence").eq("topic_id", topicId)
    .order("version", { ascending: false }).range(1, 1).limit(1);
  if (prevArr && prevArr.length > 0) prevSnapshot = prevArr[0] as { direction: string; confidence: number };

  // Signals (filtered by contract)
  let signals: TemplateSignal[] = [];
  if (snapshotId) {
    const { data } = await supabase.from("topic_signals")
      .select("source_name, source_family, signal_type, current_value, previous_value, delta, direction, freshness, weight, metadata")
      .eq("snapshot_id", snapshotId).order("weight", { ascending: false }).limit(50);
    signals = (data ?? []) as TemplateSignal[];
  }
  signals = filterSignalsByContract(signals, contract);

  const pagePublishable = isPublishable(
    { question_text: questionText, question_type: questionType },
    { slug: topicSlug, category: topicCategory },
    signals,
  );

  // History
  const { data: histData } = await supabase.from("topic_snapshots")
    .select("version, direction, confidence, published_at, current_picture_text")
    .eq("topic_id", topicId).order("version", { ascending: false }).limit(10);
  const history = (histData ?? []) as HistoryEntry[];

  // Related questions (same category)
  const relatedQuestions: RelatedQuestion[] = [];
  if (topicCategory) {
    const { data: related } = await supabase.from("question_wrappers")
      .select("question_text, topics!inner(slug, category, status, is_public)")
      .eq("is_featured", true).neq("topic_id", topicId)
      .order("sort_order", { ascending: true }).limit(20);
    const { data: relatedCards } = await supabase.from("public_topic_cards").select("slug, direction, confidence, freshness");
    const cardMap = new Map(
      (relatedCards ?? []).map((c: { slug: string; direction: string | null; confidence: number | null; freshness: string | null }) => [c.slug, c]),
    );
    for (const r of related ?? []) {
      const rt = r as unknown as { question_text: string; topics: Array<{ slug: string; category: string | null; status: string; is_public: boolean }> | { slug: string; category: string | null; status: string; is_public: boolean } };
      const rtopic = Array.isArray(rt.topics) ? rt.topics[0] : rt.topics;
      if (!rtopic || rtopic.category !== topicCategory || rtopic.status !== "active" || !rtopic.is_public) continue;
      const card = cardMap.get(rtopic.slug);
      if (!card) continue;
      relatedQuestions.push({ question_text: rt.question_text, slug: rtopic.slug, direction: card.direction, confidence: card.confidence });
      if (relatedQuestions.length >= 4) break;
    }
  }

  // Evidence preview
  const evidencePreview: EvidenceItem[] = [];
  {
    const { data: evidence } = await supabase.from("source_item_topic_matches")
      .select("source_items!inner(source_key, normalized_payload, last_seen_at)")
      .eq("topic_id", topicId).order("match_score", { ascending: false }).limit(5);
    for (const e of evidence ?? []) {
      const ei = e as unknown as { source_items: { source_key: string; normalized_payload: Record<string, unknown>; last_seen_at: string } };
      const item = Array.isArray(ei.source_items) ? ei.source_items[0] : ei.source_items;
      if (!item) continue;
      const payload = item.normalized_payload;
      const title = String(payload.title ?? payload.question ?? payload.headline ?? payload.name ?? "");
      if (!title) continue;
      const age = item.last_seen_at ? Math.round((Date.now() - new Date(item.last_seen_at).getTime()) / 3600000) : null;
      evidencePreview.push({
        title: title.slice(0, 120),
        source: SOURCE_LABELS[item.source_key] ?? item.source_key,
        date: age !== null ? (age < 1 ? "Just now" : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`) : "",
      });
    }
  }

  // Auth state
  const { data: { user } } = await supabase.auth.getUser();
  let isFollowing = false;
  if (user) {
    const { data: follow } = await supabase.from("user_followed_topics")
      .select("topic_id").eq("user_id", user.id).eq("topic_id", topicId).maybeSingle();
    isFollowing = follow !== null;
  }

  // One-liner from public_topic_cards
  const { data: publicCard } = await supabase.from("public_topic_cards")
    .select("one_liner").eq("topic_id", topicId).maybeSingle();
  const oneLiner = (publicCard as { one_liner: string | null } | null)?.one_liner ?? null;

  // Market platform provenance
  let marketPlatforms: string[] = [];
  {
    const { data: wrapperData } = await db(supabase).from("question_wrappers")
      .select("id").eq("topic_id", topicId).limit(5);
    const wrapperIds = ((wrapperData ?? []) as Array<{ id: string }>).map((w) => w.id);
    if (wrapperIds.length > 0) {
      const { data: links } = await db(supabase).from("market_question_links")
        .select("platform").in("wrapper_id", wrapperIds);
      marketPlatforms = [...new Set(((links ?? []) as Array<{ platform: string }>).map((l) => l.platform))];
    }
  }

  // Derived state
  const answerState = snapshot ? getAnswerState({
    direction: snapshot.direction,
    confidence: snapshot.confidence,
    category: topicCategory,
    disagreement: snapshot.disagreement,
  }) : null;

  return {
    pagePublishable,
    props: {
      topic: {
        id: topicId,
        canonical_name: topicCanonicalName,
        slug: topicSlug,
        category: topicCategory,
        description: topicDescription,
      },
      question: {
        id: questionId,
        question_text: questionText,
        slug: questionSlug,
        question_type: questionType,
        category: questionCategory,
      },
      contract,
      snapshot,
      prevSnapshot,
      signals,
      history,
      answerState,
      competitionAnswer,
      teamEntity,
      topicLogo,
      heroImage,
      oneLiner,
      catStyle: catStyle,
      evidencePreview,
      relatedQuestions,
      marketPlatforms,
      isAuthenticated: user !== null,
      isFollowing,
    },
  };
}
