import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as {
    suggested_name: string;
    category?: string;
  };

  if (!body.suggested_name?.trim()) {
    return NextResponse.json({ error: "Subject name required" }, { status: 400 });
  }

  const name = body.suggested_name.trim();
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  // Check auth (optional — anonymous requests allowed as demand signals)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Dedupe: check for existing requested candidate with same slug
  const { data: existing } = await supabase
    .from("topic_candidates")
    .select("id, support_count, source_item_ids")
    .eq("suggested_slug", slug)
    .in("status", ["pending", "requested"])
    .maybeSingle();

  if (existing) {
    const ex = existing as { id: string; support_count: number; source_item_ids: string[] };
    // Attach to existing — increment support_count
    await supabase
      .from("topic_candidates")
      .update({ support_count: ex.support_count + 1 })
      .eq("id", ex.id);

    return NextResponse.json({
      ok: true,
      candidate_id: ex.id,
      deduplicated: true,
    });
  }

  // Create new requested candidate
  const { data: candidate, error } = await supabase
    .from("topic_candidates")
    .insert({
      suggested_name: name,
      suggested_slug: slug,
      category: body.category ?? null,
      status: "requested",
      support_count: 1,
      // reviewed_by left null — set by admin on review, not by requester
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    candidate_id: (candidate as { id: string }).id,
    deduplicated: false,
  });
}
