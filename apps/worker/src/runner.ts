import type { SupabaseClient } from "@supabase/supabase-js";
import { dequeue, markRunning, completeJob, failJob, markDead } from "@signal-map/queue";
import type { Logger } from "@signal-map/logger";
import { getHandler } from "./jobs/index.js";
import { updateHealthState } from "./health.js";

interface RunnerOptions {
  workerId: string;
  pollIntervalMs: number;
  supabase: SupabaseClient;
  logger: Logger;
}

export async function startRunner(options: RunnerOptions) {
  const { workerId, pollIntervalMs, supabase, logger } = options;
  let running = true;

  const shutdown = () => {
    logger.info("Received shutdown signal, finishing current work...");
    running = false;
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  logger.info({ workerId, pollIntervalMs }, "Worker runner starting");

  while (running) {
    updateHealthState({ lastPollAt: new Date() });

    try {
      const job = await dequeue(supabase, workerId);

      if (job) {
        updateHealthState({
          lastClaimedJobAt: new Date(),
          runningJobCount: 1,
        });

        logger.info(
          { jobId: job.id, jobType: job.job_type },
          "Job claimed",
        );

        try {
          await markRunning(supabase, job.id);
          const handler = getHandler(job.job_type);
          await handler(job, logger, supabase);
          await completeJob(supabase, job.id);
          logger.info({ jobId: job.id }, "Job completed");
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          logger.error({ jobId: job.id, error: errorMessage }, "Job failed");

          if (job.attempt_count >= job.max_attempts) {
            await markDead(supabase, job.id);
            logger.warn({ jobId: job.id }, "Job marked dead");
          } else {
            await failJob(supabase, job.id, "HANDLER_ERROR", errorMessage);
          }
        } finally {
          updateHealthState({ runningJobCount: 0 });
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ error: errorMessage }, "Poll cycle error");
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  logger.info("Worker runner stopped");
}
