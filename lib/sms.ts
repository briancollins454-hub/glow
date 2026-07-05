// SMS sending via the Twilio REST API. No-ops gracefully when Twilio isn't
// configured, mirroring how lib/email.ts treats Resend.

export function smsConfigured(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_FROM_NUMBER
  );
}

/**
 * Normalise UK numbers to E.164: "07700 900123" -> "+447700900123".
 * Returns "" when the number doesn't look sendable.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits.length >= 11 ? digits : "";
  if (digits.startsWith("07") && digits.length === 11) return `+44${digits.slice(1)}`;
  if (digits.startsWith("447") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return "";
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsConfigured()) return false;
  const phone = normalisePhone(to);
  if (!phone) return false;

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");

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
      console.error("[twilio] send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[twilio] send threw:", (err as Error).message);
    return false;
  }
}
