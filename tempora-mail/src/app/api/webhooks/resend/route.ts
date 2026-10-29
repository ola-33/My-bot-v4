import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { Resend } from "resend";
import { cleanDomain, supabase, noStoreHeaders, assertEnv } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ReceivedEvent = { type: string; data?: { email_id?: string; to?: string[]; from?: string; subject?: string } };
export async function POST(request: NextRequest) {
  try {
    assertEnv();
    const rawBody = await request.text();
    const event = new Webhook(process.env.RESEND_WEBHOOK_SECRET!).verify(rawBody, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? ""
    }) as ReceivedEvent;
    if (event.type !== "email.received") return NextResponse.json({ received: true }, { headers: noStoreHeaders() });
    const emailId = event.data?.email_id;
    const recipients = event.data?.to ?? [];
    if (!emailId || !recipients.length) return NextResponse.json({ error: "Malformed inbound event." }, { status: 400, headers: noStoreHeaders() });
    const domain = cleanDomain();
    const addresses = [...new Set(recipients.map((v) => v.trim().toLowerCase()).filter((v) => v.endsWith(`@${domain}`)))];
    if (!addresses.length) return NextResponse.json({ received: true }, { headers: noStoreHeaders() });
    const { data: inboxes, error: inboxError } = await supabase.from("temp_inboxes").select("id,email_address").in("email_address", addresses).is("deleted_at", null).gt("expires_at", new Date().toISOString());
    if (inboxError) throw inboxError;
    if (!inboxes?.length) return NextResponse.json({ received: true }, { headers: noStoreHeaders() });
    const { data: email, error: receiveError } = await new Resend(process.env.RESEND_API_KEY!).emails.receiving.get(emailId);
    if (receiveError || !email) {
      console.error("resend_receive_fetch_failed", receiveError?.message);
      return NextResponse.json({ error: "Could not retrieve inbound email from Resend." }, { status: 502, headers: noStoreHeaders() });
    }
    const row = {
      inbox_id: inboxes[0].id, provider_email_id: emailId,
      sender: String(email.from ?? event.data?.from ?? "").slice(0, 320),
      subject: String(email.subject ?? event.data?.subject ?? "(no subject)").slice(0, 998),
      text_body: String(email.text ?? "").slice(0, 200000),
      html_body: String(email.html ?? "").slice(0, 200000)
    };
    const { error } = await supabase.from("temp_messages").upsert(row, { onConflict: "provider_email_id", ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ received: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("resend_webhook_failed", error instanceof Error ? error.message : "signature or payload error");
    return NextResponse.json({ error: "Webhook verification or processing failed." }, { status: 400, headers: noStoreHeaders() });
  }
}
