create type topic_status as enum ('active', 'archived', 'draft', 'merged');
create type source_role as enum ('signal', 'reference', 'evidence', 'watch_next');
create type job_status as enum ('pending', 'claimed', 'running', 'completed', 'failed', 'dead');
create type job_type as enum (
  'source_sync', 'topic_matching', 'topic_candidate_promotion',
  'snapshot_generation', 'summarization', 'notification_generation',
  'reconciliation', 'cleanup_archive'
);
create type signal_direction as enum ('up', 'down', 'stable', 'unknown');
create type freshness_status as enum ('fresh', 'aging', 'stale', 'dead');
create type license_class as enum ('open', 'commercial_ok', 'restricted', 'unknown');
create type risk_level as enum ('low', 'medium', 'high');
