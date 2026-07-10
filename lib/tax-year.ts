import { formatInTimeZone } from "date-fns-tz";
import { fromZonedTime } from "date-fns-tz";
import { TZ } from "@/lib/format";

export type TaxYearRange = {
  /** e.g. 2025 for the 2025/26 tax year */
  startYear: number;
  /** e.g. "2025/26" */
  label: string;
  fromIso: string;
  toIso: string;
};

/** UK tax year runs 6 April – 5 April. Returns the April-start year for a given date. */
export function taxYearStartForDate(date = new Date()): number {
  const year = parseInt(formatInTimeZone(date, TZ, "yyyy"), 10);
  const md = formatInTimeZone(date, TZ, "MM-dd");
  return md < "04-06" ? year - 1 : year;
}

export function taxYearRange(startYear: number): TaxYearRange {
  const from = fromZonedTime(`${startYear}-04-06T00:00:00`, TZ);
  const to = fromZonedTime(`${startYear + 1}-04-06T00:00:00`, TZ);
  const endYearShort = String(startYear + 1).slice(2);
  return {
    startYear,
    label: `${startYear}/${endYearShort}`,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

/** Recent tax years for the reports UI (current + two prior). */
export function selectableTaxYears(now = new Date()): TaxYearRange[] {
  const current = taxYearStartForDate(now);
  return [current, current - 1, current - 2].map(taxYearRange);
}

export function inTaxYear(iso: string, range: TaxYearRange): boolean {
  const ms = new Date(iso).getTime();
  return ms >= new Date(range.fromIso).getTime() && ms < new Date(range.toIso).getTime();
}
