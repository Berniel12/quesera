import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    sensitivity?: string;
    is_muted?: boolean;
  };

  const { error } = await supabase
    .from("alerts")
    .upsert({
      user_id: user.id,
      topic_id: topicId,
      ...body,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
