import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("alerts")
    .select("id, topic_id, sensitivity, is_muted")
    .eq("user_id", user.id);

  return NextResponse.json({ alerts: data ?? [] });
}
