export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          is_muted: boolean
          sensitivity: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_muted?: boolean
          sensitivity?: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_muted?: boolean
          sensitivity?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_topics: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          sort_order: number
          topic_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          sort_order?: number
          topic_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          sort_order?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_topics_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          slug: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          dead_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          last_error_code: string | null
          last_error_message: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          dead_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          last_error_code?: string | null
          last_error_message?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          dead_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          last_error_code?: string | null
          last_error_message?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          channel: string
          created_at: string
          delivery_error: string | null
          delivery_status: string
          id: string
          sent_at: string | null
          snapshot_id: string | null
          topic_id: string | null
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          sent_at?: string | null
          snapshot_id?: string | null
          topic_id?: string | null
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          sent_at?: string | null
          snapshot_id?: string | null
          topic_id?: string | null
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "topic_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          preferences: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          preferences?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      public_collection_publications: {
        Row: {
          collection_id: string
          description: string | null
          id: string
          published_at: string
          slug: string
          title: string
          topic_ids: string[]
          updated_at: string
        }
        Insert: {
          collection_id: string
          description?: string | null
          id?: string
          published_at?: string
          slug: string
          title: string
          topic_ids?: string[]
          updated_at?: string
        }
        Update: {
          collection_id?: string
          description?: string | null
          id?: string
          published_at?: string
          slug?: string
          title?: string
          topic_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_collection_publications_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: true
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      public_topic_cards: {
        Row: {
          canonical_name: string
          category: string | null
          confidence: number | null
          direction: Database["public"]["Enums"]["signal_direction"] | null
          freshness: Database["public"]["Enums"]["freshness_status"] | null
          one_liner: string | null
          slug: string
          snapshot_published_at: string | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          canonical_name: string
          category?: string | null
          confidence?: number | null
          direction?: Database["public"]["Enums"]["signal_direction"] | null
          freshness?: Database["public"]["Enums"]["freshness_status"] | null
          one_liner?: string | null
          slug: string
          snapshot_published_at?: string | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          category?: string | null
          confidence?: number | null
          direction?: Database["public"]["Enums"]["signal_direction"] | null
          freshness?: Database["public"]["Enums"]["freshness_status"] | null
          one_liner?: string | null
          slug?: string
          snapshot_published_at?: string | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_topic_cards_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      reprocessing_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          dry_run: boolean
          id: string
          jobs_enqueued_count: number | null
          request_notes: string | null
          requested_by: string
          scope_type: string
          source_id: string | null
          started_at: string | null
          status: string
          time_window_end: string | null
          time_window_start: string | null
          topic_id: string | null
          trigger_snapshot_generation: boolean
          trigger_summarization: boolean
          trigger_topic_matching: boolean
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dry_run?: boolean
          id?: string
          jobs_enqueued_count?: number | null
          request_notes?: string | null
          requested_by: string
          scope_type: string
          source_id?: string | null
          started_at?: string | null
          status?: string
          time_window_end?: string | null
          time_window_start?: string | null
          topic_id?: string | null
          trigger_snapshot_generation?: boolean
          trigger_summarization?: boolean
          trigger_topic_matching?: boolean
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dry_run?: boolean
          id?: string
          jobs_enqueued_count?: number | null
          request_notes?: string | null
          requested_by?: string
          scope_type?: string
          source_id?: string | null
          started_at?: string | null
          status?: string
          time_window_end?: string | null
          time_window_start?: string | null
          topic_id?: string | null
          trigger_snapshot_generation?: boolean
          trigger_summarization?: boolean
          trigger_topic_matching?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reprocessing_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_requests_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_requests_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_generation_runs: {
        Row: {
          completed_at: string | null
          confidence_delta: number | null
          created_at: string
          direction_changed: boolean | null
          error_message: string | null
          id: string
          job_queue_id: string | null
          prior_snapshot_id: string | null
          scoring_version: string
          snapshot_id: string | null
          started_at: string
          status: string
          summarization_triggered: boolean
          topic_id: string
        }
        Insert: {
          completed_at?: string | null
          confidence_delta?: number | null
          created_at?: string
          direction_changed?: boolean | null
          error_message?: string | null
          id?: string
          job_queue_id?: string | null
          prior_snapshot_id?: string | null
          scoring_version: string
          snapshot_id?: string | null
          started_at?: string
          status?: string
          summarization_triggered?: boolean
          topic_id: string
        }
        Update: {
          completed_at?: string | null
          confidence_delta?: number | null
          created_at?: string
          direction_changed?: boolean | null
          error_message?: string | null
          id?: string
          job_queue_id?: string | null
          prior_snapshot_id?: string | null
          scoring_version?: string
          snapshot_id?: string | null
          started_at?: string
          status?: string
          summarization_triggered?: boolean
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_generation_runs_job_queue_id_fkey"
            columns: ["job_queue_id"]
            isOneToOne: false
            referencedRelation: "job_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_generation_runs_prior_snapshot_id_fkey"
            columns: ["prior_snapshot_id"]
            isOneToOne: false
            referencedRelation: "topic_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_generation_runs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "topic_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_generation_runs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      source_definitions: {
        Row: {
          auth_model: string
          cadence_seconds: number
          config: Json | null
          created_at: string
          display_name: string
          entity_linking_strategy: string | null
          evidence_eligible: boolean
          id: string
          is_active: boolean
          license_class: Database["public"]["Enums"]["license_class"]
          rate_limit_policy: Json | null
          raw_payload_policy: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          role_types: Database["public"]["Enums"]["source_role"][]
          scoring_eligible: boolean
          source_family: string
          source_key: string
          updated_at: string
        }
        Insert: {
          auth_model?: string
          cadence_seconds: number
          config?: Json | null
          created_at?: string
          display_name: string
          entity_linking_strategy?: string | null
          evidence_eligible?: boolean
          id?: string
          is_active?: boolean
          license_class?: Database["public"]["Enums"]["license_class"]
          rate_limit_policy?: Json | null
          raw_payload_policy?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          role_types: Database["public"]["Enums"]["source_role"][]
          scoring_eligible?: boolean
          source_family: string
          source_key: string
          updated_at?: string
        }
        Update: {
          auth_model?: string
          cadence_seconds?: number
          config?: Json | null
          created_at?: string
          display_name?: string
          entity_linking_strategy?: string | null
          evidence_eligible?: boolean
          id?: string
          is_active?: boolean
          license_class?: Database["public"]["Enums"]["license_class"]
          rate_limit_policy?: Json | null
          raw_payload_policy?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          role_types?: Database["public"]["Enums"]["source_role"][]
          scoring_eligible?: boolean
          source_family?: string
          source_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      source_health: {
        Row: {
          consecutive_failures: number
          freshness: Database["public"]["Enums"]["freshness_status"]
          last_error_message: string | null
          last_failure_at: string | null
          last_item_count: number | null
          last_success_at: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          freshness?: Database["public"]["Enums"]["freshness_status"]
          last_error_message?: string | null
          last_failure_at?: string | null
          last_item_count?: number | null
          last_success_at?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          freshness?: Database["public"]["Enums"]["freshness_status"]
          last_error_message?: string | null
          last_failure_at?: string | null
          last_item_count?: number | null
          last_success_at?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_health_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "source_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_item_topic_matches: {
        Row: {
          created_at: string
          id: string
          match_metadata: Json | null
          match_method: string
          match_score: number | null
          source_item_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_metadata?: Json | null
          match_method: string
          match_score?: number | null
          source_item_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_metadata?: Json | null
          match_method?: string
          match_score?: number | null
          source_item_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_item_topic_matches_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "source_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_item_topic_matches_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      source_item_versions: {
        Row: {
          content_hash: string
          created_at: string
          id: string
          normalized_payload: Json
          raw_storage_path: string | null
          source_item_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          id?: string
          normalized_payload: Json
          raw_storage_path?: string | null
          source_item_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          id?: string
          normalized_payload?: Json
          raw_storage_path?: string | null
          source_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_item_versions_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "source_items"
            referencedColumns: ["id"]
          },
        ]
      }
      source_items: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          normalized_payload: Json
          occurred_at: string | null
          payload_type: string
          raw_storage_path: string | null
          source_id: string
          source_item_type: string | null
          source_key: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          normalized_payload: Json
          occurred_at?: string | null
          payload_type: string
          raw_storage_path?: string | null
          source_id: string
          source_item_type?: string | null
          source_key: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          normalized_payload?: Json
          occurred_at?: string | null
          payload_type?: string
          raw_storage_path?: string | null
          source_id?: string
          source_item_type?: string | null
          source_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          items_fetched: number | null
          items_inserted: number | null
          items_updated: number | null
          job_queue_id: string | null
          source_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          items_fetched?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          job_queue_id?: string | null
          source_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          items_fetched?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          job_queue_id?: string | null
          source_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_sync_jobs_job_queue_id_fkey"
            columns: ["job_queue_id"]
            isOneToOne: false
            referencedRelation: "job_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_sync_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          is_primary: boolean
          topic_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          is_primary?: boolean
          topic_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_aliases_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_candidates: {
        Row: {
          category: string | null
          created_at: string
          id: string
          match_scores: Json | null
          promoted_topic_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_item_ids: string[] | null
          status: string
          suggested_name: string
          suggested_slug: string
          support_count: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          match_scores?: Json | null
          promoted_topic_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_item_ids?: string[] | null
          status?: string
          suggested_name: string
          suggested_slug: string
          support_count?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          match_scores?: Json | null
          promoted_topic_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_item_ids?: string[] | null
          status?: string
          suggested_name?: string
          suggested_slug?: string
          support_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_candidates_promoted_topic_id_fkey"
            columns: ["promoted_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_latest_snapshot: {
        Row: {
          snapshot_id: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          snapshot_id: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          snapshot_id?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_latest_snapshot_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "topic_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_latest_snapshot_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_relationships: {
        Row: {
          created_at: string
          id: string
          related_topic_id: string
          relationship_type: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          related_topic_id: string
          relationship_type: string
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          related_topic_id?: string
          relationship_type?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_relationships_related_topic_id_fkey"
            columns: ["related_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_relationships_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_signals: {
        Row: {
          confidence_modifier: number | null
          created_at: string
          current_value: number | null
          delta: number | null
          direction: Database["public"]["Enums"]["signal_direction"]
          external_id: string | null
          freshness: Database["public"]["Enums"]["freshness_status"]
          id: string
          metadata: Json | null
          metric_type: string | null
          previous_value: number | null
          signal_type: string
          snapshot_id: string
          source_family: string
          source_name: string
          topic_id: string
          weight: number | null
        }
        Insert: {
          confidence_modifier?: number | null
          created_at?: string
          current_value?: number | null
          delta?: number | null
          direction?: Database["public"]["Enums"]["signal_direction"]
          external_id?: string | null
          freshness?: Database["public"]["Enums"]["freshness_status"]
          id?: string
          metadata?: Json | null
          metric_type?: string | null
          previous_value?: number | null
          signal_type: string
          snapshot_id: string
          source_family: string
          source_name: string
          topic_id: string
          weight?: number | null
        }
        Update: {
          confidence_modifier?: number | null
          created_at?: string
          current_value?: number | null
          delta?: number | null
          direction?: Database["public"]["Enums"]["signal_direction"]
          external_id?: string | null
          freshness?: Database["public"]["Enums"]["freshness_status"]
          id?: string
          metadata?: Json | null
          metric_type?: string | null
          previous_value?: number | null
          signal_type?: string
          snapshot_id?: string
          source_family?: string
          source_name?: string
          topic_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_signals_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "topic_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_signals_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_snapshots: {
        Row: {
          confidence: number | null
          created_at: string
          current_picture_text: string | null
          direction: Database["public"]["Enums"]["signal_direction"]
          disagreement: number | null
          freshness: Database["public"]["Enums"]["freshness_status"]
          id: string
          model_name: string | null
          published_at: string
          scoring_version: string | null
          snapshot_at: string
          staleness_seconds: number | null
          structured_data: Json
          summarization_version: string | null
          topic_id: string
          version: number
          what_changed_text: string | null
          what_next_text: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          current_picture_text?: string | null
          direction?: Database["public"]["Enums"]["signal_direction"]
          disagreement?: number | null
          freshness?: Database["public"]["Enums"]["freshness_status"]
          id?: string
          model_name?: string | null
          published_at?: string
          scoring_version?: string | null
          snapshot_at?: string
          staleness_seconds?: number | null
          structured_data?: Json
          summarization_version?: string | null
          topic_id: string
          version: number
          what_changed_text?: string | null
          what_next_text?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          current_picture_text?: string | null
          direction?: Database["public"]["Enums"]["signal_direction"]
          disagreement?: number | null
          freshness?: Database["public"]["Enums"]["freshness_status"]
          id?: string
          model_name?: string | null
          published_at?: string
          scoring_version?: string | null
          snapshot_at?: string
          staleness_seconds?: number | null
          structured_data?: Json
          summarization_version?: string | null
          topic_id?: string
          version?: number
          what_changed_text?: string | null
          what_next_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_snapshots_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_subtopics: {
        Row: {
          child_topic_id: string
          created_at: string
          id: string
          parent_topic_id: string
          sort_order: number
        }
        Insert: {
          child_topic_id: string
          created_at?: string
          id?: string
          parent_topic_id: string
          sort_order?: number
        }
        Update: {
          child_topic_id?: string
          created_at?: string
          id?: string
          parent_topic_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_subtopics_child_topic_id_fkey"
            columns: ["child_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_subtopics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          canonical_name: string
          category: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          embedding: string | null
          entity_refs: Json | null
          id: string
          is_public: boolean
          is_seeded: boolean
          slug: string
          status: Database["public"]["Enums"]["topic_status"]
          updated_at: string
        }
        Insert: {
          canonical_name: string
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          embedding?: string | null
          entity_refs?: Json | null
          id?: string
          is_public?: boolean
          is_seeded?: boolean
          slug: string
          status?: Database["public"]["Enums"]["topic_status"]
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          embedding?: string | null
          entity_refs?: Json | null
          id?: string
          is_public?: boolean
          is_seeded?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["topic_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_followed_topics: {
        Row: {
          followed_at: string
          id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          followed_at?: string
          id?: string
          topic_id: string
          user_id: string
        }
        Update: {
          followed_at?: string
          id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_followed_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          alert_sensitivity: string
          created_at: string
          digest_frequency: string
          email_enabled: boolean
          global_mute: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_sensitivity?: string
          created_at?: string
          digest_frequency?: string
          email_enabled?: boolean
          global_mute?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_sensitivity?: string
          created_at?: string
          digest_frequency?: string
          email_enabled?: boolean
          global_mute?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_topic_seen_snapshots: {
        Row: {
          last_seen_snapshot_id: string
          seen_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          last_seen_snapshot_id: string
          seen_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          last_seen_snapshot_id?: string
          seen_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topic_seen_snapshots_last_seen_snapshot_id_fkey"
            columns: ["last_seen_snapshot_id"]
            isOneToOne: false
            referencedRelation: "topic_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_topic_seen_snapshots_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      version_registry: {
        Row: {
          component: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json | null
          version: string
        }
        Insert: {
          component: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          version: string
        }
        Update: {
          component?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_job: {
        Args: {
          p_job_types?: Database["public"]["Enums"]["job_type"][]
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          dead_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          last_error_code: string | null
          last_error_message: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      trigram_search_topics: {
        Args: {
          max_results?: number
          min_similarity?: number
          search_text: string
        }
        Returns: {
          similarity_score: number
          topic_category: string
          topic_id: string
          topic_slug: string
        }[]
      }
    }
    Enums: {
      freshness_status: "fresh" | "aging" | "stale" | "dead"
      job_status:
        | "pending"
        | "claimed"
        | "running"
        | "completed"
        | "failed"
        | "dead"
      job_type:
        | "source_sync"
        | "topic_matching"
        | "topic_candidate_promotion"
        | "snapshot_generation"
        | "summarization"
        | "notification_generation"
        | "reconciliation"
        | "cleanup_archive"
      license_class: "open" | "commercial_ok" | "restricted" | "unknown"
      risk_level: "low" | "medium" | "high"
      signal_direction: "up" | "down" | "stable" | "unknown"
      source_role: "signal" | "reference" | "evidence" | "watch_next"
      topic_status: "active" | "archived" | "draft" | "merged"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      freshness_status: ["fresh", "aging", "stale", "dead"],
      job_status: [
        "pending",
        "claimed",
        "running",
        "completed",
        "failed",
        "dead",
      ],
      job_type: [
        "source_sync",
        "topic_matching",
        "topic_candidate_promotion",
        "snapshot_generation",
        "summarization",
        "notification_generation",
        "reconciliation",
        "cleanup_archive",
      ],
      license_class: ["open", "commercial_ok", "restricted", "unknown"],
      risk_level: ["low", "medium", "high"],
      signal_direction: ["up", "down", "stable", "unknown"],
      source_role: ["signal", "reference", "evidence", "watch_next"],
      topic_status: ["active", "archived", "draft", "merged"],
    },
  },
} as const
