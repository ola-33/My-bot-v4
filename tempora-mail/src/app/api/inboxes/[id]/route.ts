import { NextRequest, NextResponse } from "next/server";
import { sha256, supabase, noStoreHeaders, assertEnv } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertEnv();
    const { id } = await context.params;
    const token = request.headers.get("x-inbox-token") ?? "";
    if (!token || token.length > 256) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStoreHeaders() });
    const { data: inbox } = await supabase.from("temp_inboxes").select("token_hash").eq("id", id).maybeSingle();
    if (!inbox || sha256(token) !== inbox.token_hash) return NextResponse.json({ error: "Inbox not found or unauthorized." }, { status: 404, headers: noStoreHeaders() });
    const { error } = await supabase.from("temp_inboxes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ deleted: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("inbox_delete_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not delete inbox." }, { status: 500, headers: noStoreHeaders() });
  }
}
