import type { JobType, JobStatus } from "@signal-map/shared";

export interface Job {
  id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  max_attempts: number;
  attempt_count: number;
  idempotency_key: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  dead_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
}

export interface EnqueueOptions {
  job_type: JobType;
  payload?: Record<string, unknown>;
  priority?: number;
  max_attempts?: number;
  scheduled_for?: Date;
  idempotency_key?: string;
}
