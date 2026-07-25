import type { ConsentQuestionSnapshot, ConsultationQuestion, FormAnswer, Service } from "@/lib/db/types";
import { filterQuestionsForServices } from "@/lib/booking/consultation-scope";

export const CONSENT_STATEMENT =
  "I confirm the above is accurate and I consent to treatment";

const MIN_SIGNATURE_CHARS = 80;

export type ConsentFormInput = {
  signatureImage: string;
  typedName: string;
  consentAccepted: boolean;
};

export function serviceRequiresSignedConsent(
  service: Pick<Service, "requiresSignedConsent">,
): boolean {
  return service.requiresSignedConsent === true;
}

export function anyServiceRequiresSignedConsent(
  services: Array<Pick<Service, "requiresSignedConsent">>,
): boolean {
  return services.some(serviceRequiresSignedConsent);
}

/** Pull signature fields from booking form data. */
export function readConsentFormInput(formData: FormData): ConsentFormInput {
  return {
    signatureImage: String(formData.get("signatureImage") ?? "").trim(),
    typedName: String(formData.get("typedName") ?? "").trim(),
    consentAccepted: formData.get("consentAccepted") === "on",
  };
}

/**
 * Validates signature payload when consent is required.
 * Returns null when valid; otherwise a short error code.
 */
export function validateConsentFormInput(
  input: ConsentFormInput,
  required: boolean,
): "consent" | null {
  if (!required) return null;
  if (!input.consentAccepted) return "consent";
  if (!input.typedName) return "consent";
  if (!isUsableSignatureImage(input.signatureImage)) return "consent";
  return null;
}

export function isUsableSignatureImage(value: string): boolean {
  if (!value || value.length < MIN_SIGNATURE_CHARS) return false;
  // Accept data-URL PNGs/JPEGs or raw base64.
  if (value.startsWith("data:image/")) {
    const comma = value.indexOf(",");
    return comma > 0 && value.length - comma > MIN_SIGNATURE_CHARS;
  }
  return /^[A-Za-z0-9+/=\s]+$/.test(value);
}

export function collectScopedAnswers(
  questions: ConsultationQuestion[],
  services: Array<Pick<Service, "id" | "categoryId">>,
  formData: FormData,
): { applicable: ConsultationQuestion[]; answers: FormAnswer[]; snapshot: ConsentQuestionSnapshot[] } {
  const applicable = filterQuestionsForServices(questions, services);
  const answers: FormAnswer[] = [];
  const snapshot: ConsentQuestionSnapshot[] = [];

  for (const q of applicable) {
    const answer = String(formData.get(`q_${q.id}`) ?? "").trim();
    const detail = String(formData.get(`q_${q.id}_detail`) ?? "").trim();
    const combined = detail ? `${answer} - ${detail}` : answer;
    snapshot.push({
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      required: q.required,
      answer: combined,
    });
    if (combined) {
      answers.push({ prompt: q.prompt, answer: combined });
    }
  }

  return { applicable, answers, snapshot };
}

export function missingRequiredScopedAnswer(
  questions: ConsultationQuestion[],
  services: Array<Pick<Service, "id" | "categoryId">>,
  formData: FormData,
): boolean {
  const applicable = filterQuestionsForServices(questions, services);
  return applicable.some((q) => {
    if (!q.required) return false;
    return !String(formData.get(`q_${q.id}`) ?? "").trim();
  });
}

/**
 * Server-side signing time. Never accept a client-supplied timestamp.
 */
export function serverSignedAt(now: Date = new Date()): string {
  return now.toISOString();
}
