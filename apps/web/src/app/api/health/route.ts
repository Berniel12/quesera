import { NextResponse } from "next/server";
import { createSupabaseClient } from "@signal-map/db";

export async function GET() {
  let dbConnected = false;

  try {
    const supabase = createSupabaseClient({ serviceRole: true });
    const { error } = await supabase.from("topics").select("id").limit(1);
    dbConnected = !error;
  } catch {
    dbConnected = false;
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db_connected: dbConnected,
  });
}
