import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { makeBooking, makeService, makeTech } from "./fixtures";

const createPreCareConfirmation = vi.fn();
const updatePreCareConfirmation = vi.fn();

vi.mock("@/lib/db/queries", () => ({
  createPreCareConfirmation,
  updatePreCareConfirmation,
  getPreCareConfirmationByToken: vi.fn(),
  duePreCareConfirmations: vi.fn(),
  getBooking: vi.fn(),
  getClient: vi.fn(),
  getService: vi.fn(),
  getTechById: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notifyClientOfPreCare: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  randomToken: () => "tok_precare",
}));

describe("schedulePreCareConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules 48 hours before the appointment when service has pre-care text", async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
      }),
    } as never;

    createPreCareConfirmation.mockResolvedValue({ id: "pcc_1" });

    const { schedulePreCareConfirmation } = await import("@/lib/pre-care");
    await schedulePreCareConfirmation(
      sb,
      makeTech(),
      makeBooking({ startIso: "2026-07-12T15:00:00.000Z" }),
      makeService({ precareText: "Arrive with clean lashes" }),
    );

    expect(createPreCareConfirmation).toHaveBeenCalledWith(
      sb,
      expect.objectContaining({
        sendAtIso: "2026-07-10T15:00:00.000Z",
        token: "tok_precare",
      }),
    );
  });

  it("skips when service has no pre-care text", async () => {
    const sb = {} as never;
    const { schedulePreCareConfirmation } = await import("@/lib/pre-care");
    const result = await schedulePreCareConfirmation(
      sb,
      makeTech(),
      makeBooking({ startIso: "2026-07-12T15:00:00.000Z" }),
      makeService({ precareText: "" }),
    );
    expect(result).toBeNull();
    expect(createPreCareConfirmation).not.toHaveBeenCalled();
  });

  it("skips when tech has pre-care disabled", async () => {
    const sb = {} as never;
    const { schedulePreCareConfirmation } = await import("@/lib/pre-care");
    const result = await schedulePreCareConfirmation(
      sb,
      makeTech({ preCareConfirmationsEnabled: false }),
      makeBooking({ startIso: "2026-07-12T15:00:00.000Z" }),
      makeService({ precareText: "No oils" }),
    );
    expect(result).toBeNull();
    expect(createPreCareConfirmation).not.toHaveBeenCalled();
  });
});
