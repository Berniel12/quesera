import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { handleSourceSync } from "./source-sync.js";
import { handleTopicMatching } from "./topic-matching.js";
import { handleSnapshotGeneration } from "./snapshot-generation.js";
import { handleSummarization } from "./summarization.js";
import { handleNotificationGeneration } from "./notification-generation.js";
import { handleOracleSynthesis } from "./oracle-synthesis.js";

type JobHandler = (
  job: Job,
  logger: Logger,
  supabase: SupabaseClient,
) => Promise<void>;

const stubHandler: JobHandler = async (job, logger) => {
  logger.info({ jobType: job.job_type, jobId: job.id }, "Stub handler executed");
};

const handlers: Record<string, JobHandler> = {
  source_sync: handleSourceSync,
  topic_matching: handleTopicMatching,
  topic_candidate_promotion: stubHandler,
  snapshot_generation: handleSnapshotGeneration,
  summarization: handleSummarization,
  notification_generation: handleNotificationGeneration,
  oracle_synthesis: handleOracleSynthesis,
  reconciliation: stubHandler,
  cleanup_archive: stubHandler,
};

export function getHandler(jobType: string): JobHandler {
  return handlers[jobType] ?? stubHandler;
}
