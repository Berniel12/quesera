import { z } from "zod";

export const JobTypeEnum = z.enum([
  "source_sync",
  "topic_matching",
  "topic_candidate_promotion",
  "snapshot_generation",
  "summarization",
  "notification_generation",
  "oracle_synthesis",
  "reconciliation",
  "cleanup_archive",
]);
export type JobType = z.infer<typeof JobTypeEnum>;

export const JobStatusEnum = z.enum([
  "pending",
  "claimed",
  "running",
  "completed",
  "failed",
  "dead",
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

export const SignalDirectionEnum = z.enum(["up", "down", "stable", "unknown"]);
export type SignalDirection = z.infer<typeof SignalDirectionEnum>;

export const FreshnessStatusEnum = z.enum(["fresh", "aging", "stale", "dead"]);
export type FreshnessStatus = z.infer<typeof FreshnessStatusEnum>;

export const TopicStatusEnum = z.enum(["active", "archived", "draft", "merged"]);
export type TopicStatus = z.infer<typeof TopicStatusEnum>;

export const SourceRoleEnum = z.enum([
  "signal",
  "reference",
  "evidence",
  "watch_next",
]);
export type SourceRole = z.infer<typeof SourceRoleEnum>;

export const LicenseClassEnum = z.enum([
  "open",
  "commercial_ok",
  "restricted",
  "unknown",
]);
export type LicenseClass = z.infer<typeof LicenseClassEnum>;

export const RiskLevelEnum = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelEnum>;

export const OracleQueryStatusEnum = z.enum(["answered", "insufficient_data"]);
export type OracleQueryStatus = z.infer<typeof OracleQueryStatusEnum>;

export const OracleSignalSchema = z.object({
  source: z.string(),
  value: z.string(),
  probability: z.number().optional(),
  direction: z.string().optional(),
  confidence: z.string().optional(),
  updated_at: z.string(),
});
export type OracleSignal = z.infer<typeof OracleSignalSchema>;

export const OracleSignalsArraySchema = z.array(OracleSignalSchema);

export const SOURCE_FAMILIES = [
  "prediction_market",
  "forecasting",
  "news_evidence",
  "political_official",
  "macro_official",
  "hazard_weather",
  "humanitarian_conflict",
  "reference_entity",
] as const;
export type SourceFamily = (typeof SOURCE_FAMILIES)[number];
