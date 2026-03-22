#!/usr/bin/env npx tsx
/**
 * Bootstrap topic seeder — idempotent, topics + aliases only.
 * Seed data is code-owned and versioned in packages/db/supabase/seed/.
 *
 * Usage: npx tsx scripts/seed-topics.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TopicSeed {
  canonical_name: string;
  slug: string;
  category: string;
  description?: string;
  aliases: string[];
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const seedPath = resolve(
    __dirname,
    "../packages/db/supabase/seed/topics.json",
  );
  const seeds: TopicSeed[] = JSON.parse(readFileSync(seedPath, "utf-8"));

  console.log(`Seeding ${seeds.length} topics...`);

  for (const seed of seeds) {
    // Upsert topic by slug
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .upsert(
        {
          canonical_name: seed.canonical_name,
          slug: seed.slug,
          category: seed.category,
          description: seed.description ?? null,
          is_seeded: true,
          status: "active",
          is_public: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (topicError) {
      console.error(`Failed to upsert topic "${seed.slug}":`, topicError.message);
      continue;
    }

    const topicId = (topic as { id: string }).id;

    // Upsert aliases
    for (let i = 0; i < seed.aliases.length; i++) {
      const alias = seed.aliases[i];
      if (!alias) continue;
      const { error: aliasError } = await supabase.from("topic_aliases").upsert(
        {
          topic_id: topicId,
          alias,
          is_primary: i === 0,
        },
        { onConflict: "topic_id,alias" },
      );

      if (aliasError) {
        console.error(
          `Failed to upsert alias "${alias}" for "${seed.slug}":`,
          aliasError.message,
        );
      }
    }

    console.log(`  Seeded: ${seed.canonical_name} (${seed.aliases.length} aliases)`);
  }

  console.log("Seeding complete.");
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
