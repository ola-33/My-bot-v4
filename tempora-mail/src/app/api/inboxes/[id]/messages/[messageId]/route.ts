import { NextRequest, NextResponse } from "next/server";
import { sha256, supabase, noStoreHeaders, assertEnv } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; messageId: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    assertEnv();
    const { id, messageId } = await context.params;
    const token = request.headers.get("x-inbox-token") ?? "";
    if (!token || token.length > 256) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStoreHeaders() });
    const { data: inbox } = await supabase.from("temp_inboxes").select("token_hash,expires_at,deleted_at").eq("id", id).maybeSingle();
    if (!inbox || inbox.deleted_at || new Date(inbox.expires_at).getTime() <= Date.now() || sha256(token) !== inbox.token_hash) return NextResponse.json({ error: "Inbox not found, expired, or unauthorized." }, { status: 410, headers: noStoreHeaders() });
    const { data: message, error } = await supabase.from("temp_messages").select("id,sender,subject,text_body,html_body,received_at").eq("id", messageId).eq("inbox_id", id).maybeSingle();
    if (error || !message) return NextResponse.json({ error: "Message not found." }, { status: 404, headers: noStoreHeaders() });
    return NextResponse.json({ message: { id: message.id, sender: message.sender, subject: message.subject, textBody: message.text_body, htmlBody: message.html_body, receivedAt: message.received_at } }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("message_read_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not read message." }, { status: 500, headers: noStoreHeaders() });
  }
}
