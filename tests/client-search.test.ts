import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { clientMatchesQuery, filterClients } from "@/lib/clients/search";
import { makeClient } from "./fixtures";

describe("filterClients (shared by Clients page and manual booking picker)", () => {
  const clients = [
    makeClient({ id: "c1", name: "Sophie Turner", email: "sophie@example.com", phone: "07700900111" }),
    makeClient({ id: "c2", name: "Emma Parfitt", email: "elparfitt3@gmail.com", phone: "+447590598167" }),
    makeClient({ id: "c3", name: "Gemma Rowe", email: "", phone: "07388 503743" }),
  ];

  it("matches by partial name, case-insensitively", () => {
    expect(filterClients(clients, "parf").map((c) => c.id)).toEqual(["c2"]);
    expect(filterClients(clients, "SOPHIE").map((c) => c.id)).toEqual(["c1"]);
  });

  it("matches by email", () => {
    expect(filterClients(clients, "elparfitt3").map((c) => c.id)).toEqual(["c2"]);
  });

  it("matches by phone, ignoring spacing and +44 vs 0 prefix", () => {
    expect(filterClients(clients, "07590598167").map((c) => c.id)).toEqual(["c2"]);
    expect(filterClients(clients, "+447590 598167").map((c) => c.id)).toEqual(["c2"]);
    expect(filterClients(clients, "07388503743").map((c) => c.id)).toEqual(["c3"]);
  });

  it("empty query returns everyone", () => {
    expect(filterClients(clients, "").length).toBe(3);
    expect(filterClients(clients, "   ").length).toBe(3);
  });

  it("no match returns an empty list", () => {
    expect(filterClients(clients, "zzz-no-such-client")).toEqual([]);
    expect(clientMatchesQuery(clients[0]!, "zzz")).toBe(false);
  });
});

describe("client picker UI contract", () => {
  const source = readFileSync(
    resolve(__dirname, "../components/dashboard/client-picker.tsx"),
    "utf8",
  );

  it("pins the new-client option and shares the search helper", () => {
    expect(source).toContain("New client");
    expect(source).toContain('from "@/lib/clients/search"');
    // Selection must close the list (mobile keyboard flow).
    expect(source).toContain("setOpen(false)");
  });

  it("manual booking form uses the picker instead of a flat select", () => {
    const form = readFileSync(
      resolve(__dirname, "../components/dashboard/manual-booking-form.tsx"),
      "utf8",
    );
    expect(form).toContain("ClientPicker");
    expect(form).not.toMatch(/<Select name="clientId"/);
  });

  it("clients page shares the same search", () => {
    const page = readFileSync(
      resolve(__dirname, "../app/dashboard/clients/page.tsx"),
      "utf8",
    );
    expect(page).toContain('from "@/lib/clients/search"');
    expect(page).toContain("filterClients(clients, query)");
  });
});
