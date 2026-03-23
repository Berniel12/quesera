import { createClient } from "@/lib/supabase/server";
import OnboardingClient from "./onboarding-client";

export interface OnboardingQuestion {
  question_text: string;
  slug: string;
  category: string | null;
  has_snapshot: boolean;
}

export default async function OnboardingPage() {
  const supabase = await createClient();

  // Load question wrappers with onboarding context, joined to topics + cards
  const { data: rawWrappers } = await supabase
    .from("question_wrappers")
    .select(`
      question_text,
      display_context,
      sort_order,
      topics!inner (
        id,
        slug,
        category,
        status,
        is_public
      )
    `)
    .order("sort_order", { ascending: true });

  // Load published cards to check which topics are alive
  const { data: allCards } = await supabase
    .from("public_topic_cards")
    .select("topic_id");

  const aliveTopicIds = new Set((allCards ?? []).map((c: { topic_id: string }) => c.topic_id));

  // Build question list — deduplicate by slug, prefer onboarding context
  const seenSlugs = new Set<string>();
  const questions: OnboardingQuestion[] = [];

  for (const raw of rawWrappers ?? []) {
    const r = raw as unknown as {
      question_text: string;
      display_context: string | null;
      sort_order: number;
      topics: Array<{ id: string; slug: string; category: string | null; status: string; is_public: boolean }> | { id: string; slug: string; category: string | null; status: string; is_public: boolean };
    };
    const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics;
    if (!topic || topic.status !== "active" || !topic.is_public) continue;
    if (seenSlugs.has(topic.slug)) continue;
    seenSlugs.add(topic.slug);

    questions.push({
      question_text: r.question_text,
      slug: topic.slug,
      category: topic.category,
      has_snapshot: aliveTopicIds.has(topic.id),
    });
  }

  // Sort: alive topics first, then by category
  questions.sort((a, b) => {
    if (a.has_snapshot !== b.has_snapshot) return a.has_snapshot ? -1 : 1;
    return 0;
  });

  return <OnboardingClient questions={questions} />;
}
