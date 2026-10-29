import { NextRequest, NextResponse } from "next/server";
import { supabase, noStoreHeaders, assertEnv } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    assertEnv();
    if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStoreHeaders() });
    const { data, error } = await supabase.from("temp_inboxes").delete().lt("expires_at", new Date().toISOString()).select("id");
    if (error) throw error;
    return NextResponse.json({ deletedInboxes: data?.length ?? 0 }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("cleanup_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500, headers: noStoreHeaders() });
  }
}
