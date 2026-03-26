import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();

  // Auth required
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to get notified" }, { status: 401 });
  }

  // Find the oracle query
  const { data: query } = await db(supabase)
    .from("oracle_queries")
    .select("id")
    .eq("question_slug", slug)
    .maybeSingle();

  if (!query) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const queryId = (query as { id: string }).id;

  // Upsert subscription (idempotent — unique constraint handles dupes)
  const { error } = await db(supabase)
    .from("oracle_query_subscribers")
    .upsert(
      { query_id: queryId, user_id: user.id },
      { onConflict: "query_id,user_id" },
    );

  if (error) {
    return NextResponse.json({ error: "Couldn't save -- try again" }, { status: 500 });
  }

  return NextResponse.json({ subscribed: true });
}
