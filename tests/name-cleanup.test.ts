import { describe, expect, it } from "vitest";
import {
  findMalformedClients,
  isPhoneLikeName,
  nameIssueFor,
  proposeNameFix,
} from "@/lib/import/name-cleanup";
import { appointmentClientName, parseCsv } from "@/lib/csv";

describe("isPhoneLikeName", () => {
  it("accepts phone-shaped values", () => {
    expect(isPhoneLikeName("447368876064")).toBe(true);
    expect(isPhoneLikeName("+44 7368 876064")).toBe(true);
    expect(isPhoneLikeName("'07368-876064".replace("'", ""))).toBe(true);
  });

  it("rejects names and short numbers", () => {
    expect(isPhoneLikeName("Sophie Turner")).toBe(false);
    expect(isPhoneLikeName("Anna-Maria")).toBe(false);
    expect(isPhoneLikeName("123")).toBe(false);
    expect(isPhoneLikeName("")).toBe(false);
  });
});

describe("nameIssueFor / proposeNameFix", () => {
  it("flags a 6+ digit run in the name", () => {
    expect(nameIssueFor({ name: "447368876064 Cook" })).toBe("digits");
    expect(nameIssueFor({ name: "Sophie Turner" })).toBeNull();
  });

  it("flags blank names for manual review, no invented name", () => {
    const fix = proposeNameFix({ name: "   ", phone: "07700900111" });
    expect(fix?.issue).toBe("blank");
    expect(fix?.name).toBe("");
    expect(fix?.movedDigitsToPhone).toBe(false);
  });

  it("moves digits to phone only when phone is empty", () => {
    const fix = proposeNameFix({ name: "447368876064 Cook", phone: "" });
    expect(fix).toEqual({
      issue: "digits",
      name: "Cook",
      phone: "447368876064",
      movedDigitsToPhone: true,
    });
  });

  it("keeps an existing phone and still cleans the name", () => {
    const fix = proposeNameFix({ name: "447368876064 Cook", phone: "07999 111222" });
    expect(fix?.name).toBe("Cook");
    expect(fix?.phone).toBe("07999 111222");
    expect(fix?.movedDigitsToPhone).toBe(false);
  });

  it("findMalformedClients returns only affected clients", () => {
    const rows = findMalformedClients([
      { name: "447368876064 Cook", phone: "" },
      { name: "Sophie Turner", phone: "" },
      { name: "", phone: "07700900111" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.proposal.issue)).toEqual(["digits", "blank"]);
  });
});

describe("import parser keeps phone numbers out of client names", () => {
  it("drops a phone-like first name when the file has a phone column", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Phone,Type,Start Time\n447368876064,Cook,447368876064,Gel Nails,December 2, 2020 9:00 am\n",
    );
    expect(appointmentClientName(rows[0]!, headers)).toBe("Cook");
  });

  it("a fully phone-like name parses as empty, not the number", () => {
    const { headers, rows } = parseCsv(
      "Client Name,Phone,Type,Start Time\n+44 7368 876064,+44 7368 876064,Gel Nails,December 2, 2020 9:00 am\n",
    );
    expect(appointmentClientName(rows[0]!, headers)).toBe("");
  });

  it("keeps a phone-like name when there is NO separate phone column", () => {
    const { headers, rows } = parseCsv(
      "Client Name,Type,Start Time\n447368876064,Gel Nails,December 2, 2020 9:00 am\n",
    );
    expect(appointmentClientName(rows[0]!, headers)).toBe("447368876064");
  });
});
