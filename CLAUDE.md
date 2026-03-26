# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Signal Map** is a public-first, personalized signal intelligence web application. It synthesizes data from prediction markets, forecasting platforms, official government and macro datasets, hazard feeds, news/event sources, and structured signals into normalized topic pages showing:

- current picture
- what changed
- what signals currently point to
- what to watch next

Core philosophy: **“Help people make order out of world disorder.”**

Signal Map is **not**:
- a news site
- a trading terminal
- a dashboard for experts only

It **is**:
- a calm, premium, intelligent signal layer over internet chaos
- topic-first, not source-first
- public-first, with auth only for personalization

## Product Access Model

### Public layer (no auth required)
Anonymous users can:
- search topics
- browse categories
- open public topic pages
- view current picture, what changed, what’s next, timeline, and top signals
- open public collections
- share public topic/collection pages

### Authenticated layer
Logged-in users can:
- follow topics
- build a personal dashboard
- receive alerts and digests
- see “since your last visit”
- save collections
- publish collections
- manage notification preferences

### Admin layer
Admins can:
- inspect source health
- inspect jobs
- retry failed jobs
- merge/rename/archive topics
- review topic candidates
- reprocess source/topic/time windows
- inspect snapshot history
- inspect audit logs and version state

## Technical Stack

- **Frontend**: Next.js (SSR/RSC), TypeScript, shadcn/ui, Tailwind CSS
- **Backend**: Next.js route handlers + separate worker service (TypeScript)
- **Database**: Supabase Postgres with pgvector, Supabase Auth (RLS), Supabase Realtime, Supabase Storage
- **Queue**: Postgres-backed queue as durable source of truth; Redis only for cache/dedupe/short-lived locks
- **Hosting**: Render (web, worker, admin), Supabase (DB/auth/realtime/storage)
- **Observability**: Structured JSON logs, Sentry, health dashboards, run history, audit trails

## Core Architecture

### Data pipeline (worker service)
1. **Ingestion** — Source adapters pull external data into normalized `source_items`
2. **Normalization** — Source items are matched to canonical `topics` via aliases, entities, lexical rules, and pgvector
3. **Scoring** — Deterministic engine computes direction, confidence, disagreement, freshness, and top signals
4. **Snapshot publication** — Immutable `topic_snapshots` are written and `topic_latest_snapshot` pointer updated
5. **Summarization** — LLM prose runs only on material change; structured fallback publishes if LLM fails

### Critical rules
- **Deterministic scoring drives state.** LLM prose explains it but never defines it.
- **Public topic pages must work without auth.**
- **Topic pages render from latest published snapshots, never from raw live source fetches.**
- **Snapshots are immutable. Only the latest pointer changes.**
- **Reprocessing is append-only. Never mutate history in place.**
- **Cron schedules work; workers process work; Postgres records truth.**
- **Realtime only signals that a new snapshot exists. It should not deliver heavy payloads.**

## Routing Model

```text
Public:
  / 
  /topics/[slug]
  /collections/[slug]
  /search
  /categories/[category]

Authenticated:
  /dashboard
  /dashboard/topics/[slug]
  /dashboard/alerts
  /dashboard/collections
  /dashboard/settings

Admin:
  /admin
  /admin/sources
  /admin/topics
  /admin/jobs
  /admin/reprocessing
  /admin/audit
```

## Data Model (Key Entity Groups)

### Public-safe core
- `topics`
- `topic_aliases`
- `topic_relationships`
- `topic_subtopics`
- `topic_snapshots`
- `topic_signals`
- `topic_latest_snapshot`
- `public_topic_cards`
- `public_collection_publications`

### User-private
- `profiles`
- `user_followed_topics`
- `user_notification_preferences`
- `alerts`
- `notification_events`
- `user_topic_seen_snapshots`
- `collections`
- `collection_topics`

### Operational
- `source_definitions`
- `source_sync_jobs`
- `source_health`
- `source_items`
- `source_item_versions`
- `topic_candidates`
- `source_item_topic_matches`
- `snapshot_generation_runs`
- `reprocessing_requests`
- `admin_audit_logs`
- `version_registry`

## Source Architecture

### Three source roles
1. **Signal sources** — drive scoring/state
2. **Reference truth sources** — anchor official facts / metadata
3. **Evidence sources** — explain what changed

### Approved P0 source spine

#### Signal layer
- **Polymarket** — geopolitics, politics, public-interest expectation signals
- **Kalshi** — structured US politics, macro, weather/disaster expectation signals
- **Metaculus** — slower long-horizon forecast layer
- **FRED** — macro baseline
- **USGS / NOAA / NWS / Open-Meteo** — official hazard/weather signals
- **Congress.gov** — legislative event state
- **GovInfo / FEC** — official political context and factual changes

#### Evidence layer
- **One strong news API** (Bing News or equivalent)
- **RSS aggregator**
- **ReliefWeb**
- **GDELT** (high-value event/evidence source; filter carefully)

#### Reference layer
- **Wikidata/entity spine**
- official government/statistical identifiers

### Important source rules
- Not all sources affect scoring equally
- News/evidence sources do **not** directly define current-picture state by default
- Raw payloads go to object storage, not Postgres
- Source-specific cadences matter; do not force one global refresh rule
- Avoid brittle social scraping and unstable commercial terms

## Source Cadence Guidance

- **Prediction markets**: every 5 minutes for tracked/active markets
- **Forecasting**: hourly
- **News evidence**: every 15 minutes for hot topics
- **Polling**: daily or when new datasets publish
- **Macro official stats**: release-based or daily
- **Political official data**: intraday or daily depending on endpoint
- **Hazard/weather**: every 5–15 minutes
- **Humanitarian/conflict**: hourly/daily depending on source

## Queue & Processing Model

### Durable queue truth
Use a Postgres-backed queue or jobs table as the durable source of truth.

### Redis role
Redis may be used only for:
- hot response caching
- dedupe keys
- short-lived locks
- rate-limit state

Redis should **not** be the canonical truth for the work queue.

### Job types
- source sync
- topic matching
- topic candidate promotion
- snapshot generation
- summarization
- notification generation
- reconciliation
- cleanup/archive

## Matching & Topic Graph Guidance

### Topic matching flow
1. Category/domain prefilter
2. Alias/trigram lexical match
3. Vector similarity on narrowed candidate set
4. Entity overlap scoring
5. Composite match score
6. Attach to topic or create/update candidate
7. Promote candidate only under strict thresholds

### Topic seeding
At launch, seed:
- major politics topics
- major geopolitics topics
- top elections
- key public figures
- top conflicts
- top popular public-interest subjects

Do **not** rely only on automatic topic emergence for MVP.

## Snapshot & Summarization Policy

### Snapshot rules
- Snapshots are immutable
- `topic_latest_snapshot` is the latest pointer
- No `is_latest` boolean flipping across many rows
- Topic pages read from latest pointer + latest snapshot

### Summarization rules
Run LLM summarization only when:
- direction changed materially
- confidence/disagreement changed materially
- a new high-impact signal entered
- summary max-age threshold expired

If LLM fails:
- still publish structured snapshot
- show deterministic current picture, direction, freshness, and top signals
- prose is optional, not required for publication

## Delivery Phases

0. **Foundations** — monorepo, auth, migrations, observability, queue/job foundation, public/private route skeletons
1. **Data spine** — source definitions, ingestion adapters, normalized items, source health, raw archiving
2. **Topic spine** — seeded topics, matching, candidates, promotion rules, search
3. **Intelligence spine** — scoring engine, snapshot publication, latest pointer, timeline, summary generation
4. **Product surface** — public topic pages, search/discovery, auth prompts, follow, dashboard
5. **Engagement** — alerts, digests, collections, published collections
6. **Operations hardening** — admin console, retry/reprocess, rollback/versioning, incident surfacing

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Design Principles

- Public understanding should not require login
- Auth should unlock memory, following, alerts, and personalization
- Dark elegant UI
- Strong typography
- High information density, but clean
- Calm by default, live when something moves
- Raw evidence hidden behind drawers
- Trustworthy language: no fake certainty, show disagreement clearly

## Operational Guardrails

- Every admin write action must create an audit entry
- Every source adapter must declare source family, scoring eligibility, cadence, auth model, license class, and risk level
- Failed sources must surface as stale data, never silently appear fresh
- Snapshot publication must be idempotent and versioned
- Reprocessing must be scoped by source/topic/time-window and write new rows, never rewrite old ones

## Reference Documents
- `PRD.txt` — full product requirements document
- `sources.txt` — consolidated source integration guide
