import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { randomToken, sha256, ttlMinutes, cleanDomain, isValidDomain, supabase, noStoreHeaders, assertEnv } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
  try {
    assertEnv();
    const domain = cleanDomain();
    if (!isValidDomain(domain)) return NextResponse.json({ error: "MAIL_DOMAIN is not configured correctly." }, { status: 503, headers: noStoreHeaders() });
    const address = `tmp-${randomBytes(12).toString("hex")}@${domain}`;
    const token = randomToken();
    const expiresAt = new Date(Date.now() + ttlMinutes() * 60_000).toISOString();
    const { data, error } = await supabase.from("temp_inboxes").insert({ email_address: address, token_hash: sha256(token), expires_at: expiresAt }).select("id,email_address,expires_at").single();
    if (error || !data) {
      console.error("inbox_create_failed", error?.message);
      return NextResponse.json({ error: "Could not create inbox. Please try again." }, { status: 500, headers: noStoreHeaders() });
    }
    return NextResponse.json({ id: data.id, address: data.email_address, token, expiresAt: data.expires_at }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("inbox_create_error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Server configuration error. Check deployment environment variables." }, { status: 500, headers: noStoreHeaders() });
  }
}
