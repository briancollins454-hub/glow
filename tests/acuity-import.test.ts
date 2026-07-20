import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acuityCalendarCounts,
  acuityDerivedServices,
  acuityServiceNames,
  appointmentClientName,
  appointmentColumnsOk,
  appointmentServiceCol,
  appointmentWhenRaw,
  filterAcuityRowsByCalendars,
  isAcuityAppointmentCsv,
  normalizeImportPhone,
  parseAppointmentWhen,
  parseCsv,
  resolveAcuityImportRows,
} from "@/lib/csv";

const SAMPLE_PATH = resolve(__dirname, "fixtures/acuity-sample-anonymised.csv");

describe("isAcuityAppointmentCsv", () => {
  it("recognises a real Acuity appointments export", () => {
    const { headers } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    expect(isAcuityAppointmentCsv(headers)).toBe(true);
    expect(appointmentColumnsOk(headers)).toBe(true);
  });

  it("recognises a minimal Type + Start Time header set", () => {
    const { headers } = parseCsv(
      "Start Time,End Time,First Name,Last Name,Phone,Email,Type,Calendar,Date Scheduled\n",
    );
    expect(isAcuityAppointmentCsv(headers)).toBe(true);
  });

  it("does not flag Fresha exports (they have a Services column)", () => {
    const { headers } = parseCsv(
      "Appointment reference,Client,Scheduled date,Scheduled time,Duration,Services,Status\n",
    );
    expect(isAcuityAppointmentCsv(headers)).toBe(false);
  });

  it("does not flag files without a date column", () => {
    const { headers } = parseCsv("First Name,Last Name,Type\n");
    expect(isAcuityAppointmentCsv(headers)).toBe(false);
  });
});

describe("appointmentServiceCol", () => {
  it("uses Acuity's Type column when no standard service column exists", () => {
    const { headers } = parseCsv("First Name,Last Name,Type,Start Time\n");
    expect(headers[appointmentServiceCol(headers)]).toBe("type");
  });

  it("prefers the standard service column when both exist", () => {
    const { headers } = parseCsv("Client,Services,Scheduled date\n");
    expect(headers[appointmentServiceCol(headers)]).toBe("services");
  });
});

describe("appointmentClientName", () => {
  it("reads a single Client Name column", () => {
    const { headers, rows } = parseCsv(
      "Client Name,Type,Start Time\nJane Smith,Gel Nails,December 2, 2020 9:00 am\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Jane Smith");
  });

  it("combines split First Name / Last Name columns", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Type,Start Time\nJane,Smith,Gel Nails,December 2, 2020 9:00 am\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Jane Smith");
  });

  it("copes with a missing last name", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Type,Start Time\nJane,,Gel Nails,December 2, 2020 9:00 am\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Jane");
  });

  it("prefers First/Last Name over a generic Name column", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Name,Type,Start Time\nJane,Smith,Wrong Field,Gel Nails,December 2, 2020 9:00 am\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Jane Smith");
  });

  it("drops a Last Name that is just the Calendar value", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Type,Calendar,Start Time\nEmma,Dog portrait,Builder Gel (BIAB),Dog portrait,July 21, 2026 3:10 pm\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Emma");
  });
});

describe("normalizeImportPhone", () => {
  it("strips a leading apostrophe from Acuity/Excel phone numbers", () => {
    expect(normalizeImportPhone("'+447762992312")).toBe("+447762992312");
    expect(normalizeImportPhone("'07900 123456")).toBe("07900 123456");
    expect(normalizeImportPhone("+447762992312")).toBe("+447762992312");
    expect(normalizeImportPhone("")).toBe("");
  });
});

describe("Acuity long-form date parsing", () => {
  it("parses December 2, 2020 9:00 am in Europe/London", () => {
    const d = parseAppointmentWhen("December 2, 2020 9:00 am", "", {
      timeZone: "Europe/London",
    });
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2020-12-02T09:00:00.000Z");
  });

  it("parses afternoon times with am/pm", () => {
    const d = parseAppointmentWhen("December 2, 2020 1:00 pm", "", {
      timeZone: "Europe/London",
    });
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2020-12-02T13:00:00.000Z");
  });

  it("uses the Timezone column (BST in summer)", () => {
    // 1 July 2026 is BST (UTC+1).
    const d = parseAppointmentWhen("July 1, 2026 10:00 am", "", {
      timeZone: "Europe/London",
    });
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });

  it("falls back to Europe/London for an unknown timezone", () => {
    const d = parseAppointmentWhen("December 2, 2020 9:00 am", "", {
      timeZone: "Not/AZone",
    });
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2020-12-02T09:00:00.000Z");
  });

  it("prefers Start Time over Date Scheduled from a real Acuity row", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const { dateRaw, timeRaw } = appointmentWhenRaw(rows[0], headers);
    expect(dateRaw).toBe("December 2, 2020 9:00 am");
    expect(timeRaw).toBe("");
    expect(dateRaw).not.toContain("2020-11-25");

    const iTz = headers.indexOf("timezone");
    const when = parseAppointmentWhen(dateRaw, timeRaw, {
      timeZone: rows[0][iTz],
    });
    expect(when).not.toBeNull();
    expect(when!.toISOString()).toBe("2020-12-02T09:00:00.000Z");
  });

  it("parses End Time for duration against the sample fixture", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const iStart = headers.indexOf("starttime");
    const iEnd = headers.indexOf("endtime");
    const iTz = headers.indexOf("timezone");
    const start = parseAppointmentWhen(rows[0][iStart], "", { timeZone: rows[0][iTz] });
    const end = parseAppointmentWhen(rows[0][iEnd], "", { timeZone: rows[0][iTz] });
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    // 9:00 am → 10:45 am = 105 minutes
    expect(Math.round((end!.getTime() - start!.getTime()) / 60000)).toBe(105);
  });

  it("reads every Start Time in the anonymised sample fixture", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    expect(rows.length).toBe(303);
    const iTz = headers.indexOf("timezone");
    let unreadable = 0;
    for (const row of rows) {
      const { dateRaw, timeRaw } = appointmentWhenRaw(row, headers);
      const when = parseAppointmentWhen(dateRaw, timeRaw, {
        timeZone: row[iTz] ?? "Europe/London",
      });
      if (!when) unreadable++;
    }
    expect(unreadable).toBe(0);
  });

  it("still parses numeric slash dates day-first by default", () => {
    const d = parseAppointmentWhen("03/04/2026", "10:00");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3); // April
    expect(d!.getDate()).toBe(3);
  });

  it("still supports monthFirst for numeric slash dates when asked", () => {
    const d = parseAppointmentWhen("03/04/2026", "10:00", { monthFirst: true });
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(2); // March
    expect(d!.getDate()).toBe(4);
  });
});

describe("acuityDerivedServices", () => {
  it("derives unique services and prices from the Type / Appointment Price columns", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const derived = acuityDerivedServices(headers, rows);
    expect(derived.length).toBeGreaterThan(20);
    expect(acuityServiceNames(headers, rows)).toEqual(derived.map((s) => s.name));

    const acrylic = derived.find((s) => s.name === "Acrylic Rebalance/Infills");
    expect(acrylic?.pricePennies).toBe(2900);

    const brow = derived.find((s) => s.name === "Brow Wax");
    expect(brow?.pricePennies).toBe(750);
  });

  it("returns nothing when there is no Type column", () => {
    const { headers, rows } = parseCsv("Client,Services,Date\nJane,Gel Nails,03/04/2026\n");
    expect(acuityDerivedServices(headers, rows)).toEqual([]);
  });
});

describe("real Acuity sample row mapping", () => {
  it("maps First/Last, Phone, Email, Type and Appointment Price from the fixture", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const row = rows[0];
    expect(appointmentClientName(row, headers)).toBe("Erin Moore");
    expect(normalizeImportPhone(row[headers.indexOf("phone")])).toBe("+447762992312");
    expect(row[headers.indexOf("email")]).toBe("erin.moore0@example.com");
    expect(row[appointmentServiceCol(headers)]).toBe("Acrylic Rebalance/Infills");
    expect(row[headers.indexOf("appointmentprice")]).toBe("29.00");
    expect(row[headers.indexOf("calendar")]).toBe("Claire Adams");
    expect(row[headers.indexOf("datescheduled")]).toBe("2020-11-25");
  });
});

describe("Acuity calendar filter", () => {
  it("skips the filter when a file has only one calendar", () => {
    const { headers, rows } = parseCsv(
      [
        '"Start Time","End Time","Timezone","First Name","Last Name","Phone","Email","Type","Calendar","Appointment Price","Date Scheduled"',
        '"December 2, 2020 9:00 am","December 2, 2020 10:00 am","Europe/London","Jane","Smith","\'+447700900100","jane@example.com","Gel Nails","Solo Tech","25.00","2020-11-01"',
        '"December 3, 2020 9:00 am","December 3, 2020 10:00 am","Europe/London","Amy","Jones","\'+447700900101","amy@example.com","Lash Lift","Solo Tech","40.00","2020-11-01"',
      ].join("\n"),
    );
    const calendars = acuityCalendarCounts(headers, rows);
    expect(calendars).toEqual([{ name: "Solo Tech", count: 2 }]);
    const resolved = resolveAcuityImportRows(headers, rows, []);
    expect(resolved.needsCalendarPick).toBe(false);
    expect(resolved.rows).toHaveLength(2);
    expect(resolved.excludedCount).toBe(0);
  });

  it("counts appointments per calendar on the multi-staff sample fixture", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const calendars = acuityCalendarCounts(headers, rows);
    expect(calendars.map((c) => c.name).sort()).toEqual([
      "Alex Reed",
      "Claire Adams",
      "Melissa Bingham",
      "Tammy Bingham",
    ]);
    expect(calendars.find((c) => c.name === "Alex Reed")?.count).toBe(3);
    expect(calendars.find((c) => c.name === "Claire Adams")?.count).toBe(125);
    expect(calendars.find((c) => c.name === "Tammy Bingham")?.count).toBe(149);
    expect(calendars.find((c) => c.name === "Melissa Bingham")?.count).toBe(26);
    expect(calendars.reduce((sum, c) => sum + c.count, 0)).toBe(303);
  });

  it("requires a calendar pick for multi-calendar files when none are selected", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const resolved = resolveAcuityImportRows(headers, rows, []);
    expect(resolved.needsCalendarPick).toBe(true);
    expect(resolved.rows).toEqual([]);
    expect(resolved.excludedCount).toBe(303);
  });

  it("excludes other calendars from preview/save rows when some are selected", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const filtered = filterAcuityRowsByCalendars(headers, rows, ["Alex Reed"]);
    expect(filtered.rows).toHaveLength(3);
    expect(filtered.excludedCount).toBe(300);
    const iCal = headers.indexOf("calendar");
    expect(filtered.rows.every((r) => r[iCal] === "Alex Reed")).toBe(true);

    const claire = filterAcuityRowsByCalendars(headers, rows, ["Claire Adams", "Alex Reed"]);
    expect(claire.rows).toHaveLength(128);
    expect(claire.excludedCount).toBe(175);
  });

  it("derives services only from the selected calendars", () => {
    const { headers, rows } = parseCsv(readFileSync(SAMPLE_PATH, "utf8"));
    const alexRows = filterAcuityRowsByCalendars(headers, rows, ["Alex Reed"]).rows;
    const derived = acuityDerivedServices(headers, alexRows);
    const names = derived.map((s) => s.name).sort();
    expect(names).toEqual(["Alex Signature Facial", "Gel Polish Manicure"]);
    expect(derived.find((s) => s.name === "Alex Signature Facial")?.pricePennies).toBe(4500);

    // A Type that only appears on other calendars must not be offered.
    const allNames = acuityServiceNames(headers, rows);
    expect(allNames).toContain("Acrylic Rebalance/Infills");
    expect(names).not.toContain("Acrylic Rebalance/Infills");
  });
});
