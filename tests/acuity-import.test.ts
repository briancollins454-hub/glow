import { describe, expect, it } from "vitest";
import {
  acuityServiceNames,
  appointmentClientName,
  appointmentColumnsOk,
  appointmentServiceCol,
  appointmentWhenRaw,
  isAcuityAppointmentCsv,
  parseAppointmentWhen,
  parseCsv,
} from "@/lib/csv";

describe("isAcuityAppointmentCsv", () => {
  it("recognises an Acuity appointments export (Type column, no Service column)", () => {
    const { headers } = parseCsv(
      "Start Time,End Time,First Name,Last Name,Phone,Email,Type,Calendar,Date\n",
    );
    expect(isAcuityAppointmentCsv(headers)).toBe(true);
    expect(appointmentColumnsOk(headers)).toBe(true);
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
    const { headers } = parseCsv("First Name,Last Name,Type,Date,Start Time\n");
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
      "Client Name,Type,Date\nJane Smith,Gel Nails,03/04/2026\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Jane Smith");
  });

  it("combines split First Name / Last Name columns", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Type,Date\nJane,Smith,Gel Nails,03/04/2026\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Jane Smith");
  });

  it("copes with a missing last name", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Type,Date\nJane,,Gel Nails,03/04/2026\n",
    );
    expect(appointmentClientName(rows[0], headers)).toBe("Jane");
  });
});

describe("Acuity month-first date parsing", () => {
  it("parses 03/04/2026 as 4 March (month first), not 3 April", () => {
    const d = parseAppointmentWhen("03/04/2026", "10:00", { monthFirst: true });
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // March
    expect(d!.getDate()).toBe(4);
  });

  it("still parses the same string day-first without the flag", () => {
    const d = parseAppointmentWhen("03/04/2026", "10:00");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3); // April
    expect(d!.getDate()).toBe(3);
  });

  it("handles 12-hour times with AM/PM", () => {
    const d = parseAppointmentWhen("07/19/2026 3:30 PM", "", { monthFirst: true });
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(6); // July
    expect(d!.getDate()).toBe(19);
    // 3:30pm UK summer time is 14:30 UTC.
    expect(d!.getUTCHours()).toBe(14);
    expect(d!.getUTCMinutes()).toBe(30);
  });

  it("handles 24-hour times", () => {
    const d = parseAppointmentWhen("07/19/2026", "15:30", { monthFirst: true });
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(14);
  });

  it("rejects dates that fail MM/DD/YYYY parsing instead of guessing", () => {
    // Day-first UK date: 25 cannot be a month, so the row must be skipped.
    expect(parseAppointmentWhen("25/12/2026", "10:00", { monthFirst: true })).toBeNull();
    expect(parseAppointmentWhen("13/45/2026", "", { monthFirst: true })).toBeNull();
    expect(parseAppointmentWhen("not a date", "", { monthFirst: true })).toBeNull();
  });

  it("combines Acuity's separate Date and time-only Start Time columns", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,Type,Date,Start Time\nJane,Smith,Gel Nails,03/04/2026,3:00pm\n",
    );
    const { dateRaw, timeRaw } = appointmentWhenRaw(rows[0], headers);
    expect(dateRaw).toBe("03/04/2026");
    expect(timeRaw).toBe("3:00pm");
    const d = parseAppointmentWhen(dateRaw, timeRaw, { monthFirst: true });
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(2); // March
    expect(d!.getDate()).toBe(4);
    expect(d!.getUTCHours()).toBe(15); // 3pm GMT in March
  });
});

describe("acuityServiceNames", () => {
  it("derives unique services from the Type column", () => {
    const { headers, rows } = parseCsv(
      [
        "First Name,Last Name,Type,Date,Start Time",
        "Jane,Smith,Gel Nails,03/04/2026,10:00am",
        "Amy,Jones,gel nails,03/05/2026,11:00am",
        "Bea,Khan,Lash Lift,03/06/2026,12:00pm",
        "Cat,Lee,,03/07/2026,1:00pm",
      ].join("\n"),
    );
    expect(acuityServiceNames(headers, rows)).toEqual(["Gel Nails", "Lash Lift"]);
  });

  it("returns nothing when there is no Type column", () => {
    const { headers, rows } = parseCsv("Client,Services,Date\nJane,Gel Nails,03/04/2026\n");
    expect(acuityServiceNames(headers, rows)).toEqual([]);
  });
});
