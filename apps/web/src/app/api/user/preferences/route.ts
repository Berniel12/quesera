import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_notification_preferences")
    .select("email_enabled, digest_frequency, alert_sensitivity, global_mute")
    .eq("user_id", user.id)
    .maybeSingle();

  // Return defaults if no row exists
  return NextResponse.json({
    preferences: data ?? {
      email_enabled: true,
      digest_frequency: "daily",
      alert_sensitivity: "balanced",
      global_mute: false,
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    email_enabled?: boolean;
    digest_frequency?: string;
    alert_sensitivity?: string;
    global_mute?: boolean;
  };

  const { error } = await supabase
    .from("user_notification_preferences")
    .upsert({
      user_id: user.id,
      ...body,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
