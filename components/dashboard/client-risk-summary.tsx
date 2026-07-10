import { AlertTriangle, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Client, RiskTier } from "@/lib/db/types";
import { riskTierLabel, riskTierTone } from "@/lib/rules";

export function ClientRiskSummary({
  client,
  completedVisits,
  riskTier,
}: {
  client: Client;
  completedVisits: number;
  riskTier?: RiskTier | null;
}) {
  const tier = riskTier ?? null;

  return (
    <div className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <User className="h-4 w-4 text-ink-faint" />
        <span className="font-medium">{client.name}</span>
        {tier && <Badge tone={riskTierTone(tier)}>{riskTierLabel(tier)}</Badge>}
        {client.isVip && <Badge tone="purple">VIP</Badge>}
      </div>
      <ul className="mt-2 space-y-1 text-xs text-ink-soft">
        <li>{completedVisits} completed visit{completedVisits === 1 ? "" : "s"}</li>
        {client.noShowCount > 0 && (
          <li className="text-amber-300">
            {client.noShowCount} no-show{client.noShowCount === 1 ? "" : "s"} on record
          </li>
        )}
        {client.warningNote?.trim() && (
          <li className="flex items-start gap-1.5 text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{client.warningNote}</span>
          </li>
        )}
        {!client.warningNote?.trim() && client.noShowCount === 0 && completedVisits >= 2 && (
          <li className="flex items-center gap-1.5 text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Regular client with a clean record
          </li>
        )}
      </ul>
    </div>
  );
}
