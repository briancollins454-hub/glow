import { Clock } from "lucide-react";

export function OpeningHours({ hours }: { hours: { label: string; value: string }[] }) {
  if (!hours.some((d) => d.value !== "Closed")) return null;

  const today = new Date().getDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayLabel = dayNames[today];
  const flexibleOnly = hours.length === 1 && hours[0].label === "Hours";

  return (
    <section id="hours" className="scroll-mt-24 rounded-2xl border border-edge bg-surface/80 p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-brand-400" />
        <h2 className="font-display text-2xl font-semibold text-ink">Opening hours</h2>
      </div>
      {flexibleOnly ? (
        <p className="mt-4 text-sm text-ink-soft">{hours[0].value}</p>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          {hours.map((d) => {
            const isToday = d.label === todayLabel;
            return (
              <div
                key={d.label}
                className={`flex items-center justify-between rounded-lg px-2 py-1 ${
                  isToday ? "bg-brand-500/10" : ""
                }`}
              >
                <dt className={isToday ? "font-medium text-ink" : "text-ink-soft"}>
                  {d.label}
                  {isToday && (
                    <span className="ml-2 text-xs font-medium text-brand-300">Today</span>
                  )}
                </dt>
                <dd
                  className={
                    d.value === "Closed"
                      ? "text-ink-faint"
                      : isToday
                        ? "font-semibold text-ink"
                        : "font-medium text-ink"
                  }
                >
                  {d.value}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
