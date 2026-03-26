import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await db(supabase)
    .from("oracle_queries")
    .select("llm_verdict, source_signals, synthesis_failed_at")
    .eq("question_slug", slug)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const q = data as {
    llm_verdict: string | null;
    source_signals: unknown;
    synthesis_failed_at: string | null;
  };

  return NextResponse.json({
    verdict: q.llm_verdict,
    source_signals: q.source_signals,
    synthesis_failed: q.synthesis_failed_at !== null,
  });
}
