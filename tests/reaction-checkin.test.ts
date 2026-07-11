import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const createReactionCheckin = vi.fn();
const updateReactionCheckin = vi.fn();

vi.mock("@/lib/db/queries", () => ({
  createReactionCheckin,
  updateReactionCheckin,
  getReactionCheckin: vi.fn(),
  getReactionCheckinByToken: vi.fn(),
  dueReactionCheckins: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notifyClientOfReactionCheckin: vi.fn(),
  notifyTechOfReactionReport: vi.fn(),
}));

vi.mock("@/lib/product-batches", () => ({
  recordClientReaction: vi.fn(),
}));

vi.mock("@/lib/ids", () => ({
  randomToken: () => "tok_test",
}));

describe("scheduleReactionCheckin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules 48 hours after the anchor time", async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
      }),
    } as never;

    createReactionCheckin.mockResolvedValue({ id: "rci_1" });

    const { scheduleReactionCheckin } = await import("@/lib/reaction-checkin");
    await scheduleReactionCheckin(sb, {
      techId: "tech_1",
      clientId: "cli_1",
      categoryId: "cat_1",
      anchorIso: "2026-07-10T12:00:00.000Z",
      patchTestId: "pt_1",
    });

    expect(createReactionCheckin).toHaveBeenCalledWith(
      sb,
      expect.objectContaining({
        sendAtIso: "2026-07-12T12:00:00.000Z",
        token: "tok_test",
        patchTestId: "pt_1",
      }),
    );
  });

  it("skips when send time is already in the past", async () => {
    const sb = {} as never;
    const { scheduleReactionCheckin } = await import("@/lib/reaction-checkin");
    const result = await scheduleReactionCheckin(sb, {
      techId: "tech_1",
      clientId: "cli_1",
      categoryId: "cat_1",
      anchorIso: "2026-07-01T12:00:00.000Z",
    });
    expect(result).toBeNull();
    expect(createReactionCheckin).not.toHaveBeenCalled();
  });
});
