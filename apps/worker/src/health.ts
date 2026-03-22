import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "@signal-map/logger";

interface HealthState {
  lastPollAt: Date | null;
  lastClaimedJobAt: Date | null;
  runningJobCount: number;
}

const state: HealthState = {
  lastPollAt: null,
  lastClaimedJobAt: null,
  runningJobCount: 0,
};

export function updateHealthState(update: Partial<HealthState>) {
  Object.assign(state, update);
}

export function startHealthServer(
  port: number,
  workerId: string,
  supabase: SupabaseClient,
  logger: Logger,
) {
  const server = createServer(
    async (_req: IncomingMessage, res: ServerResponse) => {
      let dbConnected = false;
      let queueLagEstimate: number | null = null;

      try {
        const { data, error } = await supabase
          .from("job_queue")
          .select("scheduled_for")
          .eq("status", "pending")
          .order("scheduled_for", { ascending: true })
          .limit(1)
          .maybeSingle();

        dbConnected = !error;

        if (data && !error) {
          const oldest = new Date(
            (data as { scheduled_for: string }).scheduled_for,
          );
          queueLagEstimate =
            Math.max(0, Date.now() - oldest.getTime()) / 1000;
        }
      } catch {
        dbConnected = false;
      }

      const body = JSON.stringify({
        status: "ok",
        worker_id: workerId,
        last_poll_at: state.lastPollAt?.toISOString() ?? null,
        last_claimed_job_at: state.lastClaimedJobAt?.toISOString() ?? null,
        running_job_count: state.runningJobCount,
        queue_lag_estimate: queueLagEstimate,
        db_connected: dbConnected,
        version: process.env.RENDER_GIT_COMMIT ?? "dev",
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
    },
  );

  server.listen(port, () => {
    logger.info({ port }, "Health server listening");
  });

  return server;
}
