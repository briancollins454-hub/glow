// SMS sending via the Twilio REST API. No-ops gracefully when Twilio isn't
// configured, mirroring how lib/email.ts treats Resend.

import { salonCountry } from "@/lib/locale";

export function smsConfigured(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_FROM_NUMBER
  );
}

/** Whether this business wants client SMS (platform Twilio must also be configured). */
export function techAllowsSms(tech: { smsRemindersEnabled?: boolean | null }): boolean {
  return tech.smsRemindersEnabled !== false;
}

/**
 * Countries client SMS is enabled for. Glow's platform Twilio number is a UK
 * number and international SMS is neither enabled nor priced for other
 * destinations yet, so non-GB salons fall back to email (which always works)
 * and never see the SMS toggle. Extend deliberately, per destination, once
 * international sending is enabled and economical in Twilio.
 */
const SMS_SUPPORTED_COUNTRIES = new Set(["GB"]);

/** Platform SMS availability for one salon (config + destination country). */
export function smsSupportedForTech(
  tech: { country?: string | null } | null | undefined,
): boolean {
  return smsConfigured() && SMS_SUPPORTED_COUNTRIES.has(salonCountry(tech));
}

/** Dialling codes for local-format numbers, by salon country. */
const DIALLING_CODES: Record<string, string> = {
  GB: "44",
  IE: "353",
  US: "1",
  CA: "1",
  AU: "61",
  NZ: "64",
  DE: "49",
  FR: "33",
  ES: "34",
  IT: "39",
  NL: "31",
  BE: "32",
  PT: "351",
  AT: "43",
  CH: "41",
  SE: "46",
  NO: "47",
  DK: "45",
  PL: "48",
  CZ: "420",
  AE: "971",
  ZA: "27",
  SG: "65",
  HK: "852",
  JP: "81",
  KR: "82",
  IN: "91",
  MX: "52",
  BR: "55",
};

/**
 * Normalise a phone number to E.164 against the salon's country dialling code
 * ("07700 900123" -> "+447700900123" for GB; "0412 345 678" -> "+61412345678"
 * for AU). Returns "" when the number doesn't look sendable.
 */
export function normalisePhone(raw: string, country = "GB"): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits.length >= 11 ? digits : "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;

  // GB keeps its original mobile-only rule (07… = UK mobile) so existing
  // salons' behaviour is unchanged.
  if (country === "GB" || !DIALLING_CODES[country]) {
    if (digits.startsWith("07") && digits.length === 11) return `+44${digits.slice(1)}`;
    if (digits.startsWith("447") && digits.length === 12) return `+${digits}`;
    return "";
  }

  const code = DIALLING_CODES[country]!;
  // Already entered with the country code but no "+".
  if (digits.startsWith(code) && digits.length >= code.length + 8) {
    return `+${digits}`;
  }
  // Local format with a leading trunk "0" (AU 04…, DE 01…, IE 08… etc.).
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 11) {
    return `+${code}${digits.slice(1)}`;
  }
  // North America has no trunk zero: plain 10-digit numbers.
  if (code === "1" && /^\d{10}$/.test(digits)) return `+1${digits}`;
  return "";
}

export async function sendSms(
  to: string,
  body: string,
  opts?: { techId?: string | null; kind?: string | null; country?: string | null },
): Promise<boolean> {
  if (!smsConfigured()) return false;
  const phone = normalisePhone(to, opts?.country ?? "GB");
  if (!phone) return false;

  // Kill switches (Phase 3.2) — enforced at send layer.
  try {
    const { outboundBlockReason } = await import("@/lib/owner/controls");
    const blocked = await outboundBlockReason({ kind: opts?.kind, techId: opts?.techId });
    if (blocked) {
      console.warn("[twilio] skipped kill switch", blocked);
      try {
        const { randomId } = await import("@/lib/ids");
        const { supabaseService } = await import("@/lib/supabase/service");
        await supabaseService().from("outbound_sends").insert({
          id: randomId("out"),
          channel: "sms",
          destination: phone.slice(0, 32),
          subject: null,
          kind: opts?.kind ?? "sms",
          ok: false,
          error: blocked,
          techId: opts?.techId ?? null,
          idempotencyKey: null,
          deliveryStatus: "suppressed_skip",
        });
      } catch {
        // best-effort
      }
      return false;
    }
  } catch (err) {
    console.warn("[twilio] kill switch check failed:", (err as Error).message);
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");

  const log = async (ok: boolean, error?: string) => {
    try {
      const { randomId } = await import("@/lib/ids");
      const { supabaseService } = await import("@/lib/supabase/service");
      await supabaseService()
        .from("outbound_sends")
        .insert({
          id: randomId("out"),
          channel: "sms",
          destination: phone.slice(0, 32),
          subject: null,
          kind: opts?.kind ?? "sms",
          ok,
          error: error ?? null,
          techId: opts?.techId ?? null,
          idempotencyKey: null,
        });
    } catch {
      // Migration may be pending.
    }
  };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: process.env.TWILIO_FROM_NUMBER!,
        Body: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[twilio] send failed:", res.status, text);
      await log(false, `HTTP ${res.status}`);
      return false;
    }
    await log(true);
    return true;
  } catch (err) {
    console.error("[twilio] send threw:", (err as Error).message);
    await log(false, (err as Error).message);
    return false;
  }
}
