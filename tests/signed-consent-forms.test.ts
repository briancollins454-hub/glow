import { describe, expect, it } from "vitest";
import {
  filterQuestionsForServices,
  parseQuestionScope,
  questionAppliesToService,
  questionScopeLabel,
} from "@/lib/booking/consultation-scope";
import {
  anyServiceRequiresSignedConsent,
  collectScopedAnswers,
  consentClientDetailsForStorage,
  consentClientDetailsPrefill,
  isUsableSignatureImage,
  missingRequiredScopedAnswer,
  readConsentFormInput,
  serverSignedAt,
  validateConsentFormInput,
  type ConsentFormInput,
} from "@/lib/booking/consent";
import {
  buildConsentRecordPdf,
  consentPdfClientDetailLines,
  consentPdfFilename,
} from "@/lib/consent-pdf";
import type { ConsentRecord, ConsultationQuestion } from "@/lib/db/types";
import { makeClient, makeService, makeTech } from "./fixtures";

function makeQuestion(overrides: Partial<ConsultationQuestion> = {}): ConsultationQuestion {
  return {
    id: "q_1",
    techId: "tech_1",
    prompt: "Any allergies?",
    type: "text",
    required: false,
    sortOrder: 0,
    active: true,
    categoryId: null,
    serviceId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function validConsentInput(overrides: Partial<ConsentFormInput> = {}): ConsentFormInput {
  return {
    signatureImage: tinyPng,
    typedName: "Sophie Turner",
    consentAccepted: true,
    addressLine1: "12 High Street",
    addressLine2: "Flat 2",
    addressPostcode: "SW1A 1AA",
    emergencyContactName: "Alex Turner",
    emergencyContactPhone: "07700900222",
    ...overrides,
  };
}

function makeConsentRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: "cr_1",
    techId: "tech_1",
    clientId: "cli_1",
    bookingId: "bk_1",
    serviceId: "svc_1",
    questionsSnapshot: [
      { questionId: "q1", prompt: "Any allergies?", type: "text", required: true, answer: "None" },
    ],
    typedName: "Sophie Turner",
    signatureImage: tinyPng,
    consentAccepted: true,
    addressLine1: "12 High Street",
    addressLine2: "Flat 2",
    addressPostcode: "SW1A 1AA",
    emergencyContactName: "Alex Turner",
    emergencyContactPhone: "07700900222",
    signedAt: "2026-07-25T12:34:56.000Z",
    createdAt: "2026-07-25T12:34:56.000Z",
    ...overrides,
  };
}

describe("consultation question scope", () => {
  const piercing = makeService({ id: "svc_pierce", categoryId: "cat_pierce", name: "Lobe piercing" });
  const lashes = makeService({ id: "svc_lash", categoryId: "cat_lash", name: "Classic lashes" });

  const globalQ = makeQuestion({ id: "q_global", prompt: "Any allergies?" });
  const pierceQ = makeQuestion({
    id: "q_pierce",
    prompt: "Piercing metal preference?",
    serviceId: "svc_pierce",
  });
  const pierceCatQ = makeQuestion({
    id: "q_pierce_cat",
    prompt: "Age confirmation?",
    categoryId: "cat_pierce",
  });
  const lashQ = makeQuestion({
    id: "q_lash",
    prompt: "Lash map notes?",
    serviceId: "svc_lash",
  });

  it("shows global questions on all services", () => {
    expect(questionAppliesToService(globalQ, piercing)).toBe(true);
    expect(questionAppliesToService(globalQ, lashes)).toBe(true);
    const forLashes = filterQuestionsForServices([globalQ, pierceQ, lashQ], [lashes]);
    expect(forLashes.map((q) => q.id)).toEqual(["q_global", "q_lash"]);
  });

  it("shows a piercing-scoped question only for piercings", () => {
    expect(questionAppliesToService(pierceQ, piercing)).toBe(true);
    expect(questionAppliesToService(pierceQ, lashes)).toBe(false);
    expect(questionAppliesToService(pierceCatQ, piercing)).toBe(true);
    expect(questionAppliesToService(pierceCatQ, lashes)).toBe(false);

    const forPierce = filterQuestionsForServices(
      [globalQ, pierceQ, pierceCatQ, lashQ],
      [piercing],
    );
    expect(forPierce.map((q) => q.id)).toEqual(["q_global", "q_pierce", "q_pierce_cat"]);
  });

  it("parses scope selector values", () => {
    expect(parseQuestionScope("all")).toEqual({ categoryId: null, serviceId: null });
    expect(parseQuestionScope("service:svc_1")).toEqual({ categoryId: null, serviceId: "svc_1" });
    expect(parseQuestionScope("category:cat_1")).toEqual({ categoryId: "cat_1", serviceId: null });
  });

  it("labels scope for the forms list", () => {
    expect(questionScopeLabel(globalQ)).toBe("All services");
    expect(questionScopeLabel(pierceQ, { serviceName: "Lobe piercing" })).toBe(
      "Service: Lobe piercing",
    );
    expect(questionScopeLabel(pierceCatQ, { categoryName: "Piercings" })).toBe(
      "Category: Piercings",
    );
  });
});

describe("signed consent requirement", () => {
  it("blocks booking completion until signed when required", () => {
    const needing = makeService({ requiresSignedConsent: true });
    expect(anyServiceRequiresSignedConsent([needing])).toBe(true);
    expect(
      validateConsentFormInput(
        {
          signatureImage: "",
          typedName: "",
          consentAccepted: false,
          addressLine1: "",
          addressLine2: "",
          addressPostcode: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
        },
        true,
      ),
    ).toBe("consent");
    expect(validateConsentFormInput(validConsentInput(), true)).toBeNull();
  });

  it("requires address and emergency contact only when consent is required", () => {
    const missingAddress = validConsentInput({ addressLine1: "", addressPostcode: "" });
    expect(validateConsentFormInput(missingAddress, true)).toBe("consent");
    expect(validateConsentFormInput(missingAddress, false)).toBeNull();

    const missingEmergency = validConsentInput({
      emergencyContactName: "",
      emergencyContactPhone: "",
    });
    expect(validateConsentFormInput(missingEmergency, true)).toBe("consent");

    // Normal (non-consent) bookings do not require these fields.
    expect(anyServiceRequiresSignedConsent([makeService({ requiresSignedConsent: false })])).toBe(
      false,
    );
  });

  it("does not require a signature when the flag is off", () => {
    expect(anyServiceRequiresSignedConsent([makeService({ requiresSignedConsent: false })])).toBe(
      false,
    );
    expect(
      validateConsentFormInput(
        {
          signatureImage: "",
          typedName: "",
          consentAccepted: false,
          addressLine1: "",
          addressLine2: "",
          addressPostcode: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
        },
        false,
      ),
    ).toBeNull();
  });

  it("stores a server timestamp and answer snapshot", () => {
    const fixed = new Date("2026-07-25T12:34:56.000Z");
    expect(serverSignedAt(fixed)).toBe("2026-07-25T12:34:56.000Z");

    const questions = [
      makeQuestion({ id: "q1", prompt: "Allergies?", required: true }),
      makeQuestion({ id: "q2", prompt: "Piercing notes?", serviceId: "svc_pierce" }),
      makeQuestion({ id: "q3", prompt: "Lash notes?", serviceId: "svc_lash" }),
    ];
    const fd = new FormData();
    fd.set("q_q1", "None");
    fd.set("q_q2", "Titanium");
    fd.set("q_q3", "Should not appear");
    const piercing = makeService({ id: "svc_pierce", categoryId: "cat_pierce" });
    const { answers, snapshot } = collectScopedAnswers(questions, [piercing], fd);
    expect(answers).toEqual([
      { prompt: "Allergies?", answer: "None" },
      { prompt: "Piercing notes?", answer: "Titanium" },
    ]);
    expect(snapshot.map((s) => s.questionId)).toEqual(["q1", "q2"]);
    expect(snapshot[1].answer).toBe("Titanium");
    expect(missingRequiredScopedAnswer(questions, [piercing], new FormData())).toBe(true);
  });

  it("reads consent fields including address and emergency contact", () => {
    const fd = new FormData();
    fd.set("signatureImage", tinyPng);
    fd.set("typedName", "Sophie Turner");
    fd.set("consentAccepted", "on");
    fd.set("addressLine1", "12 High Street");
    fd.set("addressLine2", "Flat 2");
    fd.set("addressPostcode", "SW1A 1AA");
    fd.set("emergencyContactName", "Alex Turner");
    fd.set("emergencyContactPhone", "07700900222");
    expect(readConsentFormInput(fd)).toEqual(validConsentInput());
    expect(isUsableSignatureImage(tinyPng)).toBe(true);
    expect(isUsableSignatureImage("short")).toBe(false);

    const stored = consentClientDetailsForStorage(validConsentInput());
    expect(stored).toEqual({
      addressLine1: "12 High Street",
      addressLine2: "Flat 2",
      addressPostcode: "SW1A 1AA",
      emergencyContactName: "Alex Turner",
      emergencyContactPhone: "07700900222",
    });
  });
});

describe("consent record retention + PDF + prefill", () => {
  it("keeps multiple consents as separate immutable records", () => {
    const records: ConsentRecord[] = [
      makeConsentRecord({
        id: "cr_2",
        bookingId: "bk_2",
        addressLine1: "99 New Road",
        addressPostcode: "E1 1AA",
        questionsSnapshot: [
          { questionId: "q1", prompt: "Allergies?", type: "text", required: true, answer: "None" },
        ],
        signedAt: "2026-07-20T10:00:00.000Z",
        createdAt: "2026-07-20T10:00:00.000Z",
      }),
      makeConsentRecord({
        id: "cr_1",
        bookingId: "bk_1",
        addressLine1: "12 High Street",
        addressPostcode: "SW1A 1AA",
        questionsSnapshot: [
          { questionId: "q1", prompt: "Allergies?", type: "text", required: true, answer: "Nuts" },
        ],
        signedAt: "2026-06-01T10:00:00.000Z",
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    ];
    expect(records).toHaveLength(2);
    expect(records[0].questionsSnapshot[0].answer).toBe("None");
    expect(records[1].questionsSnapshot[0].answer).toBe("Nuts");
    expect(records[0].addressLine1).toBe("99 New Road");
    expect(records[1].addressLine1).toBe("12 High Street");
    expect(records[0].id).not.toBe(records[1].id);
  });

  it("prefills from a prior record but produces a fresh copy for storage", () => {
    const prior = makeConsentRecord({
      addressLine1: "12 High Street",
      addressLine2: "Flat 2",
      addressPostcode: "SW1A 1AA",
      emergencyContactName: "Alex Turner",
      emergencyContactPhone: "07700900222",
    });
    const prefill = consentClientDetailsPrefill(prior);
    expect(prefill).toEqual({
      addressLine1: "12 High Street",
      addressLine2: "Flat 2",
      addressPostcode: "SW1A 1AA",
      emergencyContactName: "Alex Turner",
      emergencyContactPhone: "07700900222",
    });
    // Mutating the prefill must not change the prior record.
    prefill.addressLine1 = "Changed";
    expect(prior.addressLine1).toBe("12 High Street");

    const fresh = consentClientDetailsForStorage(
      validConsentInput({
        ...prefill,
        addressLine1: "99 New Road",
        addressPostcode: "E1 1AA",
      }),
    );
    expect(fresh.addressLine1).toBe("99 New Road");
    expect(prior.addressLine1).toBe("12 High Street");
  });

  it("includes address and emergency contact in the PDF client-details section", async () => {
    const record = makeConsentRecord();
    expect(consentPdfClientDetailLines(record)).toEqual({
      addressLines: ["12 High Street", "Flat 2", "SW1A 1AA"],
      emergencyLine: "Emergency contact: Alex Turner · 07700900222",
    });

    const pdf = await buildConsentRecordPdf({
      tech: makeTech({ businessName: "Glow Studio" }),
      client: makeClient(),
      service: makeService({ name: "Lobe piercing" }),
      record,
      appointmentStartIso: "2026-07-26T10:00:00.000Z",
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(500);
    expect(record.signatureImage.length).toBeGreaterThan(80);
    expect(record.signedAt).toBe("2026-07-25T12:34:56.000Z");
    expect(consentPdfFilename(makeClient(), record, new Date("2026-07-25T12:00:00.000Z"))).toBe(
      "signed-consent-Sophie-Turner-2026-07-25.pdf",
    );
  });
});
