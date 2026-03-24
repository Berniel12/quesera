import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "./types";
import type { JobType } from "@signal-map/shared";

export async function dequeue(
  client: SupabaseClient,
  workerId: string,
  jobTypes?: JobType[],
): Promise<Job | null> {
  const { data, error } = await client.rpc("claim_job", {
    p_worker_id: workerId,
    p_job_types: jobTypes ?? null,
  });

  if (error) {
    throw new Error(`Failed to dequeue job: ${error.message}`);
  }

  const jobs = data as Job[] | null;
  if (!jobs || jobs.length === 0) {
    return null;
  }

  return jobs[0] ?? null;
}

export async function markRunning(
  client: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await client
    .from("job_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to mark job running: ${error.message}`);
  }
}

export async function completeJob(
  client: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await client
    .from("job_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to complete job: ${error.message}`);
  }
}

export async function failJob(
  client: SupabaseClient,
  jobId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await client
    .from("job_queue")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      last_error_code: errorCode,
      last_error_message: errorMessage,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to fail job: ${error.message}`);
  }
}

export async function markDead(
  client: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await client
    .from("job_queue")
    .update({
      status: "dead",
      dead_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to mark job dead: ${error.message}`);
  }
}
