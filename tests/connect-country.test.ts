import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeTech } from "./fixtures";

const accountsCreate = vi.fn(async () => ({ id: "acct_new" }));

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ accounts: { create: accountsCreate } }),
  stripeConfigured: () => true,
}));

const updateTech = vi.fn(async () => ({}));
vi.mock("@/lib/db/queries", () => ({
  updateTech: () => updateTech(),
}));

import {
  CONNECT_SUPPORTED_COUNTRIES,
  connectCountrySupported,
  ensureConnectAccount,
} from "@/lib/connect";
import { stripeCurrency } from "@/lib/money";

const sb = {} as SupabaseClient;

beforeEach(() => {
  accountsCreate.mockClear();
  updateTech.mockClear();
});

describe("stripeCurrency", () => {
  it("returns lowercase ISO codes for the Stripe API", () => {
    expect(stripeCurrency("GBP")).toBe("gbp");
    expect(stripeCurrency("AUD")).toBe("aud");
    expect(stripeCurrency("JPY")).toBe("jpy");
    expect(stripeCurrency(null)).toBe("gbp");
  });
});

describe("connectCountrySupported", () => {
  it("treats a missing country as GB (supported)", () => {
    expect(connectCountrySupported(null)).toBe(true);
    expect(connectCountrySupported({ country: null })).toBe(true);
    expect(CONNECT_SUPPORTED_COUNTRIES.has("GB")).toBe(true);
  });

  it("rejects countries without Connect support", () => {
    expect(connectCountrySupported({ country: "ZA" })).toBe(false);
    expect(connectCountrySupported({ country: "IN" })).toBe(false);
  });
});

describe("ensureConnectAccount", () => {
  it("short-circuits for an unsupported country without calling Stripe", async () => {
    const tech = makeTech({ country: "ZA", stripeConnectAccountId: null });
    const result = await ensureConnectAccount(sb, tech);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupported_country");
      expect(result.message).toMatch(/not available in your country/i);
    }
    expect(accountsCreate).not.toHaveBeenCalled();
    expect(updateTech).not.toHaveBeenCalled();
  });

  it("returns an existing account id without touching Stripe (pre-rollout GB accounts)", async () => {
    const tech = makeTech({ country: "ZA", stripeConnectAccountId: "acct_existing" });
    const result = await ensureConnectAccount(sb, tech);
    expect(result).toEqual({ ok: true, accountId: "acct_existing" });
    expect(accountsCreate).not.toHaveBeenCalled();
  });

  it("creates accounts with the salon's country", async () => {
    const tech = makeTech({ country: "AU", stripeConnectAccountId: null });
    const result = await ensureConnectAccount(sb, tech);
    expect(result).toEqual({ ok: true, accountId: "acct_new" });
    expect(accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ country: "AU" }),
    );
    expect(updateTech).toHaveBeenCalled();
  });
});
