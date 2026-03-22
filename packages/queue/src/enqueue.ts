import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MAX_ATTEMPTS, DEFAULT_PRIORITY } from "./constants";
import type { EnqueueOptions } from "./types";

export async function enqueue(
  client: SupabaseClient,
  options: EnqueueOptions,
): Promise<string | null> {
  const row = {
    job_type: options.job_type,
    payload: options.payload ?? {},
    priority: options.priority ?? DEFAULT_PRIORITY,
    max_attempts: options.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
    scheduled_for: (options.scheduled_for ?? new Date()).toISOString(),
    idempotency_key: options.idempotency_key ?? null,
  };

  if (row.idempotency_key) {
    const { data, error } = await client
      .from("job_queue")
      .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }

    return (data as { id: string } | null)?.id ?? null;
  }

  const { data, error } = await client
    .from("job_queue")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  return (data as { id: string }).id;
}
