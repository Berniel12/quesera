# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Signal Map** is a public-first, personalized signal intelligence web application. It synthesizes data from prediction markets, forecasting platforms, news feeds, polling, and structured signals into normalized topic pages showing: current picture, what changed, what signals point to, and what to watch next.

Core philosophy: "Help people make order out of world disorder." Not a news site, trading terminal, or expert dashboard — a calm, premium, intelligent signal layer over internet chaos.

## Technical Stack

- **Frontend**: Next.js (SSR/RSC), TypeScript, shadcn/ui, Tailwind CSS
- **Backend**: Next.js route handlers + separate worker service (TypeScript)
- **Database**: Supabase Postgres with pgvector, Supabase Auth (RLS), Supabase Realtime, Supabase Storage
- **Queue**: Postgres-backed queue (durable); Redis only for cache/dedupe/locks
- **Hosting**: Render (web, worker, admin), Supabase (DB/auth/realtime/storage)
- **Observability**: Structured JSON logs, Sentry, health dashboards

## Architecture

### Three-Layer Access Model
- **Public layer**: Anonymous access to topic pages, search, categories, collections — no auth required
- **Authenticated layer**: Follow topics, dashboard, alerts/digests, collections, "since last visit"
- **Admin layer**: Source health, job management, topic merge/rename/archive, reprocessing, audit logs

### Data Pipeline (Worker Service)
1. **Ingestion** — Source adapters pull from external APIs, normalize to `source_items`
2. **Normalization** — Raw items matched to canonical `topics` via aliases/graph
3. **Scoring** — Deterministic engine computes direction, confidence, disagreement, freshness
4. **Snapshot** — Immutable `topic_snapshots` published; `topic_latest_snapshot` pointer updated
5. **Summarization** — LLM prose runs only on material change; structured fallback if LLM fails

**Critical rule**: Deterministic scoring drives state. LLM prose explains it but never defines it.

### Routing Model
```
Public:     /  /topics/[slug]  /collections/[slug]  /search  /categories/[category]
Auth:       /dashboard  /dashboard/topics/[slug]  /dashboard/alerts  /dashboard/collections  /dashboard/settings
Admin:      /admin  /admin/sources  /admin/topics  /admin/jobs  /admin/reprocessing  /admin/audit
```

### Data Model (Key Entity Groups)
- **Public core**: topics, topic_aliases, topic_relationships, topic_snapshots, topic_signals, topic_latest_snapshot, public_topic_cards
- **User private**: profiles, user_followed_topics, user_notification_preferences, alerts, collections
- **Operational**: source_definitions, source_sync_jobs, source_health, source_items, topic_candidates, snapshot_generation_runs, reprocessing_requests, admin_audit_logs, version_registry

## MVP Source Stack (P0)

| Source | Purpose | Method | Cadence |
|--------|---------|--------|---------|
| Kalshi | US politics, macro, weather prediction markets | REST polling | 5 min |
| Polymarket | Geopolitics, global politics, pop-culture signals | Gamma/public APIs | 5 min |
| Metaculus | Long-horizon forecasts, community predictions | REST API | 15-30 min |
| Bing News API | Evidence layer, news context | REST API | 15 min |
| FiveThirtyEight/Polling | Election signals, polling averages | RSS + scrape | 30-60 min |
| FRED | Macro economic baselines | REST API | Daily |
| Government APIs | Congress.gov, GovInfo, FEC | REST API | Varies |
| Hazard Feeds | USGS, NWS, Open-Meteo, GDACS | REST/XML | 5-15 min |

Source strategy: Signal sources drive scoring; evidence sources explain changes; reference sources anchor metadata; alert sources trigger freshness.

## Delivery Phases

0. **Foundations** — Monorepo, auth, migrations, observability, queue/job foundation, route skeletons
1. **Data spine** — Source definitions, ingestion adapters, normalized items, health, raw archiving
2. **Topic spine** — Seeded topics, matching, candidate queue, promotion rules, search
3. **Intelligence spine** — Scoring engine, snapshot publication, timeline, summary generation
4. **Product surface** — Public topic pages, search/discovery, auth prompts, follow, dashboard
5. **Engagement** — Alerts, digests, collections, published collections
6. **Operations hardening** — Admin console, retry/reprocess, rollback/versioning, incident surfacing

## Key Design Decisions

- **Public-first**: Auth unlocks personalization, not access. Topic pages must work without login.
- **Topic-first, not source-first**: Users see subjects, not data sources.
- **Dark elegant UI**: Premium feel, strong typography, high density but clean. Calm by default, live when something moves.
- **Soft delete only**: Topics, source items, and collections use archive/soft-delete. No hard deletes except user follows.
- **Immutable snapshots**: Snapshot content never mutates; only the latest pointer changes.
- **Edge cacheable**: Public topic pages must be SSR, cacheable, and fast (O(1) latest snapshot reads).
- **Structured fallback**: If summarization or any LLM step fails, the structured snapshot still publishes.
- **Append-only operations**: Reprocessing creates new snapshots, never mutates history.

## MCP Servers

- **Supabase MCP** — All database communication
- **context7 MCP** — Documentation lookups
- **shadcn MCP** — UI component library
- **Sequential Thinking MCP** — Complex multi-step reasoning
- **Chrome DevTools MCP** — Console logs and website preview
- **Tavily MCP** — Web search for docs, bugs, solutions

## Reference Documents

- `PRD.txt` — Full 26-section product requirements document
- `sources.txt` — Detailed API integration guide and source stack planning
