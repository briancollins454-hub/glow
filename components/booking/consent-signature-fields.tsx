"use client";

import { CONSENT_STATEMENT } from "@/lib/booking/consent";
import { SignaturePad } from "@/components/booking/signature-pad";

/** Signature step shown when a booked service requires signed consent. */
export function ConsentSignatureFields() {
  return (
    <div className="space-y-4 border-t border-edge pt-4">
      <div>
        <p className="text-sm font-medium text-ink">Signed consent</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          This treatment needs a signed consent record before your booking can be completed.
        </p>
      </div>
      <SignaturePad required />
      <div>
        <label className="mb-1 block text-sm text-ink-soft">
          Type your full name <span className="text-red-400">*</span>
        </label>
        <input
          name="typedName"
          required
          autoComplete="name"
          placeholder="Full legal name"
          className="input"
        />
      </div>
      <label className="flex items-start gap-2.5 text-sm text-ink-soft">
        <input
          name="consentAccepted"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
        />
        <span>{CONSENT_STATEMENT}</span>
      </label>
    </div>
  );
}
