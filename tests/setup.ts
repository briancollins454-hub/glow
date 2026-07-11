// Allow server-only modules (e.g. lib/ids.ts) to load under Vitest.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
