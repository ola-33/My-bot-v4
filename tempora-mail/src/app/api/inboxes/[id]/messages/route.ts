import { NextRequest, NextResponse } from "next/server";
import { sha256, supabase, noStoreHeaders, assertEnv } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function authorized(request: NextRequest, id: string) {
  const token = request.headers.get("x-inbox-token") ?? "";
  if (!token || token.length > 256) return null;
  const { data, error } = await supabase.from("temp_inboxes").select("id,token_hash,expires_at,deleted_at").eq("id", id).maybeSingle();
  if (error || !data || data.deleted_at || new Date(data.expires_at).getTime() <= Date.now() || sha256(token) !== data.token_hash) return null;
  return data;
}
export async function GET(request: NextRequest, context: Context) {
  try {
    assertEnv();
    const { id } = await context.params;
    if (!await authorized(request, id)) return NextResponse.json({ error: "Inbox not found, expired, or unauthorized." }, { status: 410, headers: noStoreHeaders() });
    const { data, error } = await supabase.from("temp_messages").select("id,sender,subject,received_at").eq("inbox_id", id).order("received_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ messages: (data ?? []).map((m) => ({ id: m.id, sender: m.sender, subject: m.subject, receivedAt: m.received_at })) }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("message_list_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not load inbox." }, { status: 500, headers: noStoreHeaders() });
  }
}
