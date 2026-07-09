import { BellRing, ShieldCheck, Sparkles } from "lucide-react";

export function TrustStrip() {
  const items = [
    { icon: ShieldCheck, label: "Secure deposit" },
    { icon: BellRing, label: "Automatic reminders" },
    { icon: Sparkles, label: "Built for beauty pros" },
  ];

  return (
    <section className="rounded-2xl border border-edge bg-surface/60 px-4 py-5 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center justify-center gap-2 text-sm text-ink-soft sm:justify-start">
            <Icon className="h-4 w-4 shrink-0 text-brand-400" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
