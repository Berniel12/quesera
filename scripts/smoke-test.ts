#!/usr/bin/env npx tsx
/**
 * Phase 0 RLS smoke tests — run against live Supabase.
 * Usage: npx tsx scripts/smoke-test.ts (with .env.local sourced)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const anon = createClient(url, anonKey);
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

async function main() {
  console.log("=== Phase 0 Smoke Tests ===\n");

  // 1. Anon can read public topics
  const { data: topics, error: topicErr } = await anon
    .from("topics")
    .select("slug, canonical_name")
    .limit(3);
  check("Anon reads public topics", !topicErr && (topics?.length ?? 0) > 0, topicErr?.message);

  // 2. Anon can read aliases for public topics
  const { data: aliases, error: aliasErr } = await anon
    .from("topic_aliases")
    .select("alias")
    .limit(3);
  check("Anon reads public aliases", !aliasErr && (aliases?.length ?? 0) > 0, aliasErr?.message);

  // 3. Anon cannot read user_followed_topics (empty due to RLS)
  const { data: follows } = await anon
    .from("user_followed_topics")
    .select("*")
    .limit(1);
  check("Anon blocked from user_followed_topics", (follows?.length ?? 0) === 0);

  // 4. Service role can access job_queue
  const { error: queueErr } = await admin
    .from("job_queue")
    .select("id")
    .limit(1);
  check("Service role reads job_queue", !queueErr, queueErr?.message);

  // 5. Anon blocked from job_queue (no RLS = no rows returned)
  const { data: queueAnon } = await anon
    .from("job_queue")
    .select("id")
    .limit(1);
  check("Anon blocked from job_queue", (queueAnon?.length ?? 0) === 0);

  // 6. Anon blocked from source_definitions
  const { data: srcAnon } = await anon
    .from("source_definitions")
    .select("id")
    .limit(1);
  check("Anon blocked from source_definitions", (srcAnon?.length ?? 0) === 0);

  // 7. Service role can insert + read job
  const { data: job, error: insertErr } = await admin
    .from("job_queue")
    .insert({
      job_type: "source_sync",
      payload: { test: true },
    })
    .select("id")
    .single();
  check("Service role inserts test job", !insertErr && !!job, insertErr?.message);

  // 8. Verify the test job exists
  if (job) {
    const jobId = (job as { id: string }).id;
    const { data: fetched, error: fetchErr } = await admin
      .from("job_queue")
      .select("status, job_type")
      .eq("id", jobId)
      .single();
    check(
      "Test job readable with pending status",
      !fetchErr && (fetched as { status: string } | null)?.status === "pending",
      fetchErr?.message,
    );

    // Cleanup
    await admin.from("job_queue").delete().eq("id", jobId);
  }

  // 9. Non-public topic test: create a non-public topic, verify anon can't see it
  const { data: privateTopic } = await admin
    .from("topics")
    .insert({
      canonical_name: "_test_private_topic",
      slug: "_test-private-topic",
      category: "test",
      is_public: false,
      status: "active",
    })
    .select("id")
    .single();

  if (privateTopic) {
    const privateId = (privateTopic as { id: string }).id;
    const { data: anonPrivate } = await anon
      .from("topics")
      .select("id")
      .eq("id", privateId);
    check("Anon blocked from non-public topics", (anonPrivate?.length ?? 0) === 0);

    // Cleanup
    await admin.from("topics").delete().eq("id", privateId);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
