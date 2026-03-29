#!/usr/bin/env node
/**
 * QUESERA Coherence Audit Script
 *
 * Checks every featured page for:
 * 1. Platform-count mismatch (card count vs actual signals)
 * 2. Stale prose (older than 7 days)
 * 3. Entity duplicates in competition rankings
 * 4. Signal contamination (wrong series on topic)
 * 5. Layer B quality (phrased output still valid)
 * 6. Wrong-year references in prose
 *
 * Run: node scripts/audit-coherence.mjs
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SIGNAL_ALLOWLIST = {
  "us-federal-reserve-interest-rates": ["FEDFUNDS", "DGS10", "MORTGAGE30US"],
  "us-inflation-rate": ["CPIAUCSL", "CUSR0000SA0", "CUUR0000SA0"],
  "us-unemployment-rate": ["UNRATE", "LNS14000000", "CES0000000001"],
  "us-stock-market": ["SP500", "DGS10"],
  "global-oil-prices": ["PET.RWTC.W"],
  "us-mortgage-rates": ["MORTGAGE30US", "DGS10"],
};

async function main() {
  console.log("=== QUESERA Coherence Audit ===\n");
  let issues = 0;

  // Load featured questions with card data
  const { data: pages } = await supabase
    .from("questions")
    .select("slug, primary_topic_id, question_type")
    .eq("is_featured", true)
    .eq("status", "published");

  if (!pages) {
    console.error("Failed to load questions");
    return;
  }

  for (const page of pages) {
    const topicId = page.primary_topic_id;

    // Load card
    const { data: card } = await supabase
      .from("public_topic_cards")
      .select("slug, platform_count, platform_names, source_family_count, synthesis_ready, synthesis_phrased, expert_line")
      .eq("topic_id", topicId)
      .maybeSingle();

    // Load latest snapshot signals
    const { data: latestPointer } = await supabase
      .from("topic_latest_snapshot")
      .select("snapshot_id")
      .eq("topic_id", topicId)
      .maybeSingle();

    if (!latestPointer) continue;
    const snapshotId = latestPointer.snapshot_id;

    const { data: signals } = await supabase
      .from("topic_signals")
      .select("source_name, source_family, metadata")
      .eq("snapshot_id", snapshotId);

    const { data: snapshot } = await supabase
      .from("topic_snapshots")
      .select("current_picture_text, what_changed_text, what_next_text, published_at, synthesis_phrased")
      .eq("id", snapshotId)
      .single();

    if (!signals || !snapshot) continue;

    const topicSlug = card?.slug ?? page.slug;
    const actualPlatforms = [...new Set(signals.map((s) => s.source_name))];

    // Check 1: Platform count mismatch
    if (card?.platform_count && card.platform_count !== actualPlatforms.length) {
      console.log(`[PLATFORM MISMATCH] ${topicSlug}: card says ${card.platform_count} platforms, actual signals have ${actualPlatforms.length}`);
      issues++;
    }

    // Check 2: Stale prose
    const pubDate = new Date(snapshot.published_at);
    const ageHours = (Date.now() - pubDate.getTime()) / 3600000;
    if (ageHours > 168) { // 7 days
      console.log(`[STALE PROSE] ${topicSlug}: last snapshot ${Math.round(ageHours / 24)} days old`);
      issues++;
    }

    // Check 3: Wrong-year references
    const allProse = `${snapshot.current_picture_text ?? ""} ${snapshot.what_changed_text ?? ""} ${snapshot.what_next_text ?? ""}`;
    if (/\b202[45]\b/.test(allProse) && !/\b2026\b/.test(allProse)) {
      console.log(`[WRONG YEAR] ${topicSlug}: prose references 2024/2025 without 2026 context`);
      issues++;
    }

    // Check 4: Signal contamination (macro signals not in allowlist)
    const allowlist = SIGNAL_ALLOWLIST[topicSlug];
    if (allowlist) {
      for (const sig of signals) {
        if (sig.source_family === "macro_official") {
          const seriesId = sig.metadata?.series_id;
          if (seriesId && !allowlist.includes(seriesId)) {
            console.log(`[SIGNAL CONTAMINATION] ${topicSlug}: series ${seriesId} not in allowlist`);
            issues++;
          }
        }
      }
    }

    // Check 5: Entity duplicates (competition pages)
    if (page.question_type === "competition") {
      const entities = signals
        .filter((s) => s.source_family === "prediction_market" || s.source_family === "sports_odds")
        .map((s) => {
          const q = s.metadata?.question ?? "";
          const match = q.match(/^Will (.+?) win\b/i);
          return match?.[1]?.replace(/^(the|a|an)\s+/i, "").trim();
        })
        .filter(Boolean);

      const seen = new Map();
      for (const e of entities) {
        const lower = e.toLowerCase();
        for (const [existing] of seen) {
          if (existing.includes(lower) || lower.includes(existing)) {
            console.log(`[ENTITY DUPLICATE] ${topicSlug}: "${e}" and "${seen.get(existing)}" are likely the same entity`);
            issues++;
            break;
          }
        }
        seen.set(lower, e);
      }
    }

    // Check 6: Layer B quality (phrased output present but potentially stale)
    if (snapshot.synthesis_phrased) {
      const phrased = snapshot.synthesis_phrased;
      if (phrased.bottom_line && /\b202[45]\b/.test(phrased.bottom_line)) {
        console.log(`[PHRASED WRONG YEAR] ${topicSlug}: bottom_line references 2024/2025`);
        issues++;
      }
    }
  }

  console.log(`\n=== Audit complete: ${issues} issues found across ${pages.length} pages ===`);
  process.exit(issues > 0 ? 1 : 0);
}

main().catch(console.error);
