"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CONSENT_STATEMENT,
  type ConsentClientDetails,
  EMPTY_CONSENT_CLIENT_DETAILS,
} from "@/lib/booking/consent";
import { SignaturePad } from "@/components/booking/signature-pad";
import { loadConsentPrefillAction } from "@/app/[handle]/actions";

/** Signature step shown when a booked service requires signed consent. */
export function ConsentSignatureFields({
  handle,
  defaults = EMPTY_CONSENT_CLIENT_DETAILS,
}: {
  handle: string;
  defaults?: ConsentClientDetails;
}) {
  const [details, setDetails] = useState<ConsentClientDetails>(defaults);
  const [pending, startTransition] = useTransition();
  const lastEmail = useRef("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Prefill address / emergency contact from the client's most recent consent
  // when they enter an email already on file (editable; saved fresh on submit).
  useEffect(() => {
    const root = rootRef.current;
    const form = root?.closest("form");
    const emailInput = form?.querySelector<HTMLInputElement>('input[name="email"]');
    if (!emailInput) return;

    const onBlur = () => {
      const email = emailInput.value.trim().toLowerCase();
      if (!email || !email.includes("@") || email === lastEmail.current) return;
      lastEmail.current = email;
      startTransition(async () => {
        const prefill = await loadConsentPrefillAction(handle, email);
        if (!prefill) return;
        setDetails((prev) => ({
          addressLine1: prev.addressLine1 || prefill.addressLine1,
          addressLine2: prev.addressLine2 || prefill.addressLine2,
          addressPostcode: prev.addressPostcode || prefill.addressPostcode,
          emergencyContactName: prev.emergencyContactName || prefill.emergencyContactName,
          emergencyContactPhone: prev.emergencyContactPhone || prefill.emergencyContactPhone,
        }));
      });
    };

    emailInput.addEventListener("blur", onBlur);
    return () => emailInput.removeEventListener("blur", onBlur);
  }, [handle]);

  return (
    <div ref={rootRef} className="space-y-4 border-t border-edge pt-4">
      <div>
        <p className="text-sm font-medium text-ink">Signed consent</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          This treatment needs a signed consent record before your booking can be completed.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-ink">Your details for this record</p>
        <div>
          <label className="mb-1 block text-sm text-ink-soft">
            Address <span className="text-red-400">*</span>
          </label>
          <input
            name="addressLine1"
            required
            autoComplete="address-line1"
            placeholder="Address line 1"
            className="input"
            value={details.addressLine1}
            onChange={(e) => setDetails((d) => ({ ...d, addressLine1: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-soft">Address line 2</label>
          <input
            name="addressLine2"
            autoComplete="address-line2"
            placeholder="Flat, building (optional)"
            className="input"
            value={details.addressLine2}
            onChange={(e) => setDetails((d) => ({ ...d, addressLine2: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-soft">
            Postcode <span className="text-red-400">*</span>
          </label>
          <input
            name="addressPostcode"
            required
            autoComplete="postal-code"
            placeholder="Postcode"
            className="input max-w-[12rem] uppercase"
            value={details.addressPostcode}
            onChange={(e) => setDetails((d) => ({ ...d, addressPostcode: e.target.value }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-soft">
              Emergency contact name <span className="text-red-400">*</span>
            </label>
            <input
              name="emergencyContactName"
              required
              autoComplete="off"
              placeholder="Full name"
              className="input"
              value={details.emergencyContactName}
              onChange={(e) => setDetails((d) => ({ ...d, emergencyContactName: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-soft">
              Emergency contact phone <span className="text-red-400">*</span>
            </label>
            <input
              name="emergencyContactPhone"
              required
              type="tel"
              autoComplete="tel"
              placeholder="Mobile number"
              className="input"
              value={details.emergencyContactPhone}
              onChange={(e) => setDetails((d) => ({ ...d, emergencyContactPhone: e.target.value }))}
            />
          </div>
        </div>
        {pending && (
          <p className="text-xs text-ink-faint">Looking up your previous details…</p>
        )}
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
