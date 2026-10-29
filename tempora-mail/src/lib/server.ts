import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","RESEND_API_KEY","RESEND_WEBHOOK_SECRET","MAIL_DOMAIN","CRON_SECRET"] as const;
export function assertEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing server environment variables: ${missing.join(", ")}`);
}
export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export function ttlMinutes() {
  const parsed = Number(process.env.INBOX_TTL_MINUTES ?? "60");
  return Number.isFinite(parsed) ? Math.min(1440, Math.max(10, Math.floor(parsed))) : 60;
}
export function cleanDomain() { return (process.env.MAIL_DOMAIN ?? "").trim().toLowerCase().replace(/^@/, ""); }
export function isValidDomain(domain: string) { return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain); }
export function noStoreHeaders() { return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }; }
