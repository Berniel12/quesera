/**
 * Shared types for question-native page templates.
 * Each template (competition, threshold, binary_event) receives
 * the same TemplateProps -- what it renders is the difference.
 */

import type { AnswerState } from "@/lib/answer-state";
import type { QuestionContract, QuestionType } from "@/lib/question-contracts";
import type { CompetitionAnswer, TeamEntity } from "@/lib/team-entities";

// ── Signal shape (as loaded from topic_signals) ──

export interface TemplateSignal {
  source_name: string;
  source_family: string;
  signal_type: string;
  current_value: number;
  previous_value: number | null;
  delta: number | null;
  direction: string;
  freshness: string;
  weight: number;
  metadata: Record<string, unknown> | null;
}

// ── Snapshot shape (from topic_snapshots) ──

export interface TemplateSnapshot {
  direction: string;
  confidence: number;
  disagreement: number;
  freshness: string;
  staleness_seconds: number | null;
  current_picture_text: string | null;
  what_changed_text: string | null;
  what_next_text: string | null;
  structured_data: Record<string, unknown>;
  published_at: string;
  version: number;
  synthesis_json: SourceComparison | null;
}

/** Deterministic source comparison (computed by worker, no LLM) */
export interface SourceComparison {
  predictivePlatforms: string[];
  strengtheningFamilies: string[];
  predictiveAvgProbability: number | null;
  predictiveSpreadPp: number | null;
  platformBreakdown: Array<{
    platform: string;
    displayName: string;
    avgProbability: number;
    signalCount: number;
    topQuestion: string;
  }>;
  primaryGroundingMetric: {
    source: string;
    name: string;
    value: number;
    formatted: string;
    delta: number | null;
    deltaFormatted: string | null;
  } | null;
  groundingAlignment: "supports" | "neutral" | "contradicts" | null;
  groundingInterpretation: "supports_yes" | "supports_no" | "neutral" | null;
  agreementState: "consensus" | "mild_divergence" | "sharp_divergence" | "insufficient_data";
  comparisonConfidence: "high" | "medium" | "low";
  leadPlatform: string | null;
}

// ── History entry (for timeline) ──

export interface HistoryEntry {
  version: number;
  direction: string;
  confidence: number;
  published_at: string;
  current_picture_text: string | null;
}

// ── Evidence preview item ──

export interface EvidenceItem {
  title: string;
  source: string;
  date: string;
}

// ── Related question ──

export interface RelatedQuestion {
  question_text: string;
  slug: string;
  direction: string | null;
  confidence: number | null;
}

// ── Category style ──

export interface CategoryStyle {
  accent: string;
  border: string;
  bg: string;
}

// ── The full props every template receives ──

export interface TemplateProps {
  // Core identifiers
  topic: {
    id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    description: string | null;
  };
  question: {
    id: string;
    question_text: string;
    slug: string;
    question_type: QuestionType | null;
    category: string | null;
  };
  contract: QuestionContract;

  // Snapshot + signals (already filtered by contract)
  snapshot: TemplateSnapshot | null;
  prevSnapshot: { direction: string; confidence: number } | null;
  signals: TemplateSignal[];
  history: HistoryEntry[];

  // Derived display state
  answerState: AnswerState | null;
  competitionAnswer: CompetitionAnswer | null;
  teamEntity: TeamEntity | null;
  topicLogo: { logoUrl: string; bgColor: string } | null;
  heroImage: string | null;
  oneLiner: string | null;
  catStyle: CategoryStyle;

  // Context
  evidencePreview: EvidenceItem[];
  relatedQuestions: RelatedQuestion[];
  marketPlatforms: string[];

  // Auth state
  isAuthenticated: boolean;
  isFollowing: boolean;
}
