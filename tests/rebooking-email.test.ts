import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBooking, makeClient, makeService, makeTech } from "./fixtures";

const updateClient = vi.fn(async () => undefined);
const sendEmail = vi.fn(async () => true);

vi.mock("@/lib/db/queries", () => ({
  listLiveTechs: vi.fn(async () => [
    makeTech({ id: "tech_1", rebookNudgesEnabled: true, subscriptionStatus: "active" }),
  ]),
  listClients: vi.fn(async () => [] as ReturnType<typeof makeClient>[]),
  listBookings: vi.fn(async () => [] as ReturnType<typeof makeBooking>[]),
  listServices: vi.fn(async () => [makeService()]),
  updateClient,
}));

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...actual,
    sendEmail,
    brandedEmail: actual.brandedEmail,
  };
});

describe("processRebookNudges email handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("skips clients with invalid emails", async () => {
    const queries = await import("@/lib/db/queries");
    vi.mocked(queries.listClients).mockResolvedValue([
      makeClient({
        id: "cli_bad",
        email: "user@example.com",
        messageToken: "tok",
        lastNudgeAtIso: null,
      }),
    ]);
    const past = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(queries.listBookings).mockResolvedValue([
      makeBooking({
        id: "bk_1",
        clientId: "cli_bad",
        status: "completed",
        startIso: past,
        endIso: past,
      }),
    ]);

    const { processRebookNudges } = await import("@/lib/rebooking");
    const sent = await processRebookNudges({} as never);
    expect(sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(updateClient).not.toHaveBeenCalled();
  });

  it("stamps lastNudgeAtIso even when send fails so dead addresses are not retried", async () => {
    sendEmail.mockResolvedValueOnce(false);
    const queries = await import("@/lib/db/queries");
    vi.mocked(queries.listClients).mockResolvedValue([
      makeClient({
        id: "cli_ok",
        email: "sophie@glow-uk.com",
        messageToken: "tok",
        lastNudgeAtIso: null,
      }),
    ]);
    const past = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(queries.listBookings).mockResolvedValue([
      makeBooking({
        id: "bk_1",
        clientId: "cli_ok",
        status: "completed",
        startIso: past,
        endIso: past,
      }),
    ]);

    const { processRebookNudges } = await import("@/lib/rebooking");
    const sent = await processRebookNudges({} as never);
    expect(sent).toBe(0);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(updateClient).toHaveBeenCalledWith(
      expect.anything(),
      "cli_ok",
      expect.objectContaining({ lastNudgeAtIso: expect.any(String) }),
    );

    // Next run within cooldown must not retry.
    vi.mocked(queries.listClients).mockResolvedValue([
      makeClient({
        id: "cli_ok",
        email: "sophie@glow-uk.com",
        messageToken: "tok",
        lastNudgeAtIso: new Date().toISOString(),
      }),
    ]);
    sendEmail.mockClear();
    updateClient.mockClear();
    const sent2 = await processRebookNudges({} as never);
    expect(sent2).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(updateClient).not.toHaveBeenCalled();
  });
});
