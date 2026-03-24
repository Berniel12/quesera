import type { SupabaseClient } from "@supabase/supabase-js";
import { dequeue, markRunning, completeJob, failJob, markDead } from "@signal-map/queue";
import type { Job } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { getHandler } from "./jobs/index.js";
import { updateHealthState } from "./health.js";

interface RunnerOptions {
  workerId: string;
  pollIntervalMs: number;
  supabase: SupabaseClient;
  logger: Logger;
}

// Process a single job from claim to completion/failure
async function processJob(
  job: Job,
  supabase: SupabaseClient,
  logger: Logger,
): Promise<void> {
  try {
    await markRunning(supabase, job.id);
    const handler = getHandler(job.job_type);
    await handler(job, logger, supabase);
    await completeJob(supabase, job.id);
    logger.info({ jobId: job.id, jobType: job.job_type }, "Job completed");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ jobId: job.id, error: errorMessage }, "Job failed");

    if (job.attempt_count >= job.max_attempts) {
      await markDead(supabase, job.id);
      logger.warn({ jobId: job.id }, "Job marked dead");
    } else {
      await failJob(supabase, job.id, "HANDLER_ERROR", errorMessage);
    }
  }
}

export async function startRunner(options: RunnerOptions) {
  const { workerId, pollIntervalMs, supabase, logger } = options;
  const concurrency = Number(process.env.WORKER_CONCURRENCY ?? "3");
  let running = true;
  let activeCount = 0;

  const shutdown = () => {
    logger.info("Received shutdown signal, finishing current work...");
    running = false;
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  logger.info({ workerId, pollIntervalMs, concurrency }, "Worker runner starting (concurrent)");

  while (running) {
    updateHealthState({ lastPollAt: new Date(), runningJobCount: activeCount });

    // Fill up to concurrency limit
    if (activeCount >= concurrency) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }

    try {
      const job = await dequeue(supabase, workerId);

      if (job) {
        activeCount++;
        updateHealthState({
          lastClaimedJobAt: new Date(),
          runningJobCount: activeCount,
        });

        logger.info({ jobId: job.id, jobType: job.job_type, active: activeCount }, "Job claimed");

        // Run job concurrently -- don't await
        processJob(job, supabase, logger)
          .finally(() => {
            activeCount--;
            updateHealthState({ runningJobCount: activeCount });
          });
      } else {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ error: errorMessage }, "Poll cycle error");
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  // Wait for active jobs to finish before exiting
  while (activeCount > 0) {
    logger.info({ activeCount }, "Waiting for active jobs to finish");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  logger.info("Worker runner stopped");
}
