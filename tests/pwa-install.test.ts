import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("promptInstall", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unavailable when no deferred event", async () => {
    const { promptInstall } = await import("@/lib/pwa-install");
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("prompts and clears the deferred event on accept", async () => {
    const listeners = new Map<string, Array<(event: Event) => void>>();
    vi.stubGlobal("window", {
      addEventListener(type: string, fn: (event: Event) => void) {
        const list = listeners.get(type) ?? [];
        list.push(fn);
        listeners.set(type, list);
      },
    });

    const { ensureInstallCapture, promptInstall, getInstallEvent } = await import(
      "@/lib/pwa-install"
    );

    ensureInstallCapture();
    const prompt = vi.fn(async () => undefined);
    const userChoice = Promise.resolve({ outcome: "accepted" as const, platform: "web" });
    const event = {
      preventDefault() {},
      prompt,
      userChoice,
    } as unknown as Event;

    for (const fn of listeners.get("beforeinstallprompt") ?? []) {
      fn(event);
    }

    expect(getInstallEvent()).toBeTruthy();
    await expect(promptInstall()).resolves.toBe("accepted");
    expect(prompt).toHaveBeenCalledOnce();
    expect(getInstallEvent()).toBeNull();
  });
});
