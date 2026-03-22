import * as Sentry from "@sentry/node";
import { createLogger } from "@signal-map/logger";
import { createClient } from "@supabase/supabase-js";
import { startRunner } from "./runner.js";
import { startHealthServer } from "./health.js";

const logger = createLogger("worker");

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
  });
  logger.info("Sentry initialized");
}

// Validate required env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  logger.fatal(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const workerId = process.env.WORKER_ID ?? "worker-1";
const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? "1000");
const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? "8081");

// Start health server
startHealthServer(healthPort, workerId, supabase, logger);

// Start the runner
startRunner({
  workerId,
  pollIntervalMs,
  supabase,
  logger,
}).catch((err) => {
  logger.fatal({ error: err }, "Runner crashed");
  Sentry.captureException(err);
  process.exit(1);
});
