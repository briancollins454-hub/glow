import { Check, Minus } from "lucide-react";

type Cell = string | "yes" | "no" | "partial";

type Row = { label: string; glow: Cell; fresha: Cell; booksy: Cell; square: Cell };

const ROWS: Row[] = [
  {
    label: "Monthly cost (solo)",
    glow: "£19 flat",
    fresha: "From £14.95 + VAT",
    booksy: "£40 + VAT",
    square: "£0 to £69",
  },
  {
    label: "Commission on new clients",
    glow: "None",
    fresha: "20% first visit via marketplace (min £4)",
    booksy: "30% with Boost on (optional)",
    square: "None",
  },
  {
    label: "Deposits at base price",
    glow: "yes",
    fresha: "yes",
    booksy: "yes",
    square: "yes",
  },
  {
    label: "Patch test gating (blocks booking)",
    glow: "yes",
    fresha: "no",
    booksy: "no",
    square: "no",
  },
  {
    label: "Configurable patch test expiry",
    glow: "yes",
    fresha: "no",
    booksy: "no",
    square: "no",
  },
  {
    label: "Infill booking rules enforced",
    glow: "yes",
    fresha: "no",
    booksy: "no",
    square: "no",
  },
  {
    label: "Booking approval before deposit",
    glow: "yes",
    fresha: "no",
    booksy: "no",
    square: "yes",
  },
  {
    label: "Blocked clients cannot book online",
    glow: "yes",
    fresha: "partial",
    booksy: "partial",
    square: "partial",
  },
  {
    label: "Client payments to your bank",
    glow: "Stripe Connect (direct)",
    fresha: "Via Fresha Payments",
    booksy: "Via Booksy Payments",
    square: "Via Square",
  },
  {
    label: "Full account data export",
    glow: "yes",
    fresha: "partial",
    booksy: "partial",
    square: "partial",
  },
  {
    label: "CSV import from competitors",
    glow: "yes",
    fresha: "no",
    booksy: "no",
    square: "Square export only",
  },
  {
    label: "Built for UK beauty techs",
    glow: "yes",
    fresha: "no",
    booksy: "no",
    square: "no",
  },
];

const COLS = [
  { key: "glow" as const, label: "Glow", highlight: true },
  { key: "fresha" as const, label: "Fresha", highlight: false },
  { key: "booksy" as const, label: "Booksy", highlight: false },
  { key: "square" as const, label: "Square", highlight: false },
];

function CellValue({ value }: { value: Cell }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-success-text">
        <Check className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only">Yes</span>
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center gap-1 text-ink-faint">
        <Minus className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only">No</span>
      </span>
    );
  }
  if (value === "partial") {
    return <span className="text-ink-soft">Limited</span>;
  }
  return <span className="text-ink-soft">{value}</span>;
}

export function ComparisonTable() {
  return (
    <>
      <div className="card mt-10 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-ink-faint">
              <th className="p-4 font-medium" />
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={`p-4 font-semibold ${col.highlight ? "text-brand-text" : "font-medium"}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={`border-b border-edge ${i === ROWS.length - 1 ? "border-b-0" : ""}`}
              >
                <td className="p-4 text-ink-soft">{row.label}</td>
                {COLS.map((col) => (
                  <td
                    key={col.key}
                    className={`p-4 ${col.highlight ? "bg-brand-500/5 font-medium text-ink" : ""}`}
                  >
                    <CellValue value={row[col.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 space-y-3 lg:hidden">
        {ROWS.map((row) => (
          <div key={row.label} className="card p-4">
            <p className="text-sm font-medium text-ink">{row.label}</p>
            <dl className="mt-3 space-y-2 text-sm">
              {COLS.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3">
                  <dt className={col.highlight ? "font-semibold text-brand-text" : "text-ink-faint"}>
                    {col.label}
                  </dt>
                  <dd className="max-w-[58%] text-right">
                    <CellValue value={row[col.key]} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-ink-faint">
        Competitor details from public UK pricing pages. Features change. Boost on Booksy and Fresha
        marketplace fees are optional but catch techs out when enabled.
      </p>
    </>
  );
}
