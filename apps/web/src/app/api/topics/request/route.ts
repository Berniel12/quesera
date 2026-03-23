import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as {
    question_text?: string;
    suggested_name?: string; // backwards compat
    category?: string;
  };

  const questionText = (body.question_text ?? body.suggested_name ?? "").trim();
  if (!questionText) {
    return NextResponse.json({ error: "Question text required" }, { status: 400 });
  }

  // Normalize to slug for deduplication
  const normalizedSlug = questionText
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  // Check auth (optional — anonymous requests are valid demand signals)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Dedupe: check for existing pending request with same normalized slug
  const { data: existing } = await supabase
    .from("question_requests")
    .select("id, support_count")
    .eq("normalized_slug", normalizedSlug)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const ex = existing as { id: string; support_count: number };
    await supabase
      .from("question_requests")
      .update({ support_count: ex.support_count + 1 })
      .eq("id", ex.id);

    return NextResponse.json({
      ok: true,
      request_id: ex.id,
      deduplicated: true,
      message: "Others have asked this too. We're on it.",
    });
  }

  // Fuzzy-check against existing topics (advisory, not auto-promote)
  let matchedTopicId: string | null = null;
  const { data: topicHits } = await supabase
    .rpc("search_topics_trigram", { search_term: questionText, result_limit: 1 });

  if (topicHits && topicHits.length > 0) {
    const hit = topicHits[0] as { id: string; similarity: number };
    if (hit.similarity > 0.2) {
      matchedTopicId = hit.id;
    }
  }

  // Create new question request
  const { data: created, error } = await supabase
    .from("question_requests")
    .insert({
      question_text: questionText,
      normalized_slug: normalizedSlug,
      matched_topic_id: matchedTopicId,
      support_count: 1,
      status: "pending",
      requested_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    request_id: (created as { id: string }).id,
    deduplicated: false,
    matched_topic: matchedTopicId !== null,
  });
}
