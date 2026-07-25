import type {
  ConsentQuestionSnapshot,
  ConsentRecord,
  ConsultationQuestion,
  FormAnswer,
  Service,
} from "@/lib/db/types";
import {
  buildPackScopeIndex,
  filterQuestionsForServices,
  type PackScopeIndex,
} from "@/lib/booking/consultation-scope";
import type { ConsultationPack, ConsultationPackTarget } from "@/lib/db/types";

export const CONSENT_STATEMENT =
  "I confirm the above is accurate and I consent to treatment";

const MIN_SIGNATURE_CHARS = 80;

/** Structured client details captured only on signed-consent bookings. */
export type ConsentClientDetails = {
  addressLine1: string;
  addressLine2: string;
  addressPostcode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export type ConsentFormInput = ConsentClientDetails & {
  signatureImage: string;
  typedName: string;
  consentAccepted: boolean;
};

export const EMPTY_CONSENT_CLIENT_DETAILS: ConsentClientDetails = {
  addressLine1: "",
  addressLine2: "",
  addressPostcode: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
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

/** Pull signature + client-detail fields from booking form data. */
export function readConsentFormInput(formData: FormData): ConsentFormInput {
  return {
    signatureImage: String(formData.get("signatureImage") ?? "").trim(),
    typedName: String(formData.get("typedName") ?? "").trim(),
    consentAccepted: formData.get("consentAccepted") === "on",
    addressLine1: String(formData.get("addressLine1") ?? "").trim(),
    addressLine2: String(formData.get("addressLine2") ?? "").trim(),
    addressPostcode: String(formData.get("addressPostcode") ?? "").trim(),
    emergencyContactName: String(formData.get("emergencyContactName") ?? "").trim(),
    emergencyContactPhone: String(formData.get("emergencyContactPhone") ?? "").trim(),
  };
}

/**
 * Validates signature + client details when consent is required.
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
  if (!input.addressLine1) return "consent";
  if (!input.addressPostcode) return "consent";
  if (!input.emergencyContactName) return "consent";
  if (!input.emergencyContactPhone) return "consent";
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
  packIndex?: PackScopeIndex,
): { applicable: ConsultationQuestion[]; answers: FormAnswer[]; snapshot: ConsentQuestionSnapshot[] } {
  const applicable = filterQuestionsForServices(questions, services, packIndex);
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
  packIndex?: PackScopeIndex,
): boolean {
  const applicable = filterQuestionsForServices(questions, services, packIndex);
  return applicable.some((q) => {
    if (!q.required) return false;
    return !String(formData.get(`q_${q.id}`) ?? "").trim();
  });
}

export function packIndexFromLists(
  packs: ConsultationPack[],
  targets: ConsultationPackTarget[],
): PackScopeIndex {
  return buildPackScopeIndex(packs, targets);
}

/**
 * Prefill values from a prior consent record. Returns a fresh copy of the
 * client-detail fields only (never mutates the source record).
 */
export function consentClientDetailsPrefill(
  record: Pick<
    ConsentRecord,
    | "addressLine1"
    | "addressLine2"
    | "addressPostcode"
    | "emergencyContactName"
    | "emergencyContactPhone"
  > | null | undefined,
): ConsentClientDetails {
  if (!record) return { ...EMPTY_CONSENT_CLIENT_DETAILS };
  return {
    addressLine1: record.addressLine1 ?? "",
    addressLine2: record.addressLine2 ?? "",
    addressPostcode: record.addressPostcode ?? "",
    emergencyContactName: record.emergencyContactName ?? "",
    emergencyContactPhone: record.emergencyContactPhone ?? "",
  };
}

/** Slice of a consent form input stored on a new consent_records row. */
export function consentClientDetailsForStorage(input: ConsentFormInput): ConsentClientDetails {
  return {
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    addressPostcode: input.addressPostcode,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
  };
}

/**
 * Server-side signing time. Never accept a client-supplied timestamp.
 */
export function serverSignedAt(now: Date = new Date()): string {
  return now.toISOString();
}
