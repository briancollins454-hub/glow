import { describe, expect, it } from "vitest";
import { col, moneyToPennies, parseCsv, parseCsvLine, toMinutes, appointmentColumnsOk, appointmentWhenRaw, missingAppointmentGroups, parseAppointmentWhen, isPlausibleServiceName } from "@/lib/csv";

describe("parseCsvLine", () => {
  it("splits simple lines", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted fields with commas", () => {
    expect(parseCsvLine('"Smith, Jane",jane@example.com')).toEqual(["Smith, Jane", "jane@example.com"]);
  });
  it("handles escaped quotes", () => {
    expect(parseCsvLine('"She said ""hi""",x')).toEqual(['She said "hi"', "x"]);
  });
});

describe("parseCsv", () => {
  it("normalises headers to lowercase letters", () => {
    const { headers, rows } = parseCsv("First Name,E-mail Address\nJane,j@x.com");
    expect(headers).toEqual(["firstname", "emailaddress"]);
    expect(rows).toEqual([["Jane", "j@x.com"]]);
  });
  it("skips blank lines", () => {
    const { rows } = parseCsv("name\n\nJane\n\n");
    expect(rows).toEqual([["Jane"]]);
  });
  it("handles newlines inside quoted fields (Fresha descriptions)", () => {
    const { headers, rows } = parseCsv(
      'Category,Service name,Description,Duration,Price\n"Brow treatments","Henna brows","Henna is a natural\ndye that lasts weeks","30min","30.00"\n',
    );
    expect(headers).toEqual(["category", "servicename", "description", "duration", "price"]);
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Henna brows");
    expect(rows[0][2]).toContain("natural");
    expect(rows[0][2]).toContain("weeks");
  });
});

describe("col", () => {
  it("finds the first matching header", () => {
    expect(col(["clientname", "email"], "name", "clientname")).toBe(0);
    expect(col(["a", "b"], "missing")).toBe(-1);
  });
});

describe("Fresha appointment imports", () => {
  const freshaHeaders = parseCsv(
    "Appointment reference,Client,Team member,Resource,Scheduled date,Scheduled time,Duration,Services,Status\n",
  ).headers;

  it("recognises Fresha Sales → Appointments export columns", () => {
    expect(appointmentColumnsOk(freshaHeaders)).toBe(true);
    expect(missingAppointmentGroups(freshaHeaders)).toEqual([]);
  });

  it("combines Fresha scheduled date and time", () => {
    const { headers, rows } = parseCsv(
      "Client,Services,Scheduled date,Scheduled time\nKayleigh Hastings,Classic Lash Extensions,06/07/2024,10:30\n",
    );
    expect(appointmentWhenRaw(rows[0], headers)).toEqual({
      dateRaw: "06/07/2024",
      timeRaw: "10:30",
    });
  });

  it("uses Fresha scheduled time when it is a full timestamp", () => {
    const { headers, rows } = parseCsv(
      "Client,Services,Scheduled date,Scheduled time\nKayleigh Hastings,Classic Lash Extensions,,2024-07-06 10:30:00\n",
    );
    expect(appointmentWhenRaw(rows[0], headers)).toEqual({
      dateRaw: "2024-07-06 10:30:00",
      timeRaw: "",
    });
  });
});

describe("isPlausibleServiceName", () => {
  it("rejects misparsed CSV fragments", () => {
    expect(isPlausibleServiceName("Henna brows")).toBe(true);
    expect(isPlausibleServiceName(",Exclusive Deals,Henna Brows,Not required")).toBe(false);
    expect(isPlausibleServiceName("Henna is a natural")).toBe(true);
  });
});

describe("parseAppointmentWhen", () => {
  it("parses Fresha scheduled date strings", () => {
    const d = parseAppointmentWhen("04 Jul 2026, 3:00pm");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6);
    expect(d!.getDate()).toBe(4);
  });

  it("parses UK slash dates", () => {
    const d = parseAppointmentWhen("04/07/2026", "15:30");
    expect(d).not.toBeNull();
  });
});

describe("moneyToPennies", () => {
  it("parses currency strings", () => {
    expect(moneyToPennies("£45.00")).toBe(4500);
    expect(moneyToPennies("45.5")).toBe(4550);
    expect(moneyToPennies("not money")).toBe(0);
  });

  it("rejects large integer IDs mistaken for prices", () => {
    expect(moneyToPennies("23759921")).toBe(0);
    expect(moneyToPennies("2375992100")).toBe(0);
  });
});

describe("toMinutes", () => {
  it("parses common duration formats", () => {
    expect(toMinutes("90")).toBe(90);
    expect(toMinutes("1h 30m")).toBe(90);
    expect(toMinutes("1:30")).toBe(90);
    expect(toMinutes("90 min")).toBe(90);
    expect(toMinutes("")).toBe(0);
  });

  it("rejects huge bare numbers that are probably IDs", () => {
    expect(toMinutes("2375992100")).toBe(60);
  });
});
