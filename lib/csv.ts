// Tolerant CSV parsing for migration imports (Square / Booksy / Timely / Fresha
// exports all differ; we normalise headers and match flexibly).

export interface ParsedCsv {
  /** Normalised headers: lowercase, letters only ("First Name" -> "firstname") */
  headers: string[];
  rows: string[][];
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

/** Index of the first header matching any of the given normalised names. */
export function col(headers: string[], ...names: string[]): number {
  return headers.findIndex((h) => names.includes(h));
}

/** "£45.00", "45", "45.5" -> pennies. NaN-safe. */
export function moneyToPennies(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? 0 : Math.round(n * 100);
}

/** "1h 30m", "90", "90 min", "1:30" -> minutes. */
export function toMinutes(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (!s) return 0;
  const hm = s.match(/^(\d+):(\d{2})$/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h || m) return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1], 10) : 0));
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? 0 : Math.round(n);
}
