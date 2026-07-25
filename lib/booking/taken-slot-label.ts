export type TakenSlotLabelFields = {
  time: string;
  takenName?: string;
  takenInitial?: string;
  overrideReason?: "conflict" | "blocked" | "outside_hours";
};

/** Display label fragment for a taken booking ("Booked (Full Name)"). */
export function takenSlotBookedLabel(
  o: Pick<TakenSlotLabelFields, "takenName" | "takenInitial">,
): string | null {
  const name = o.takenName?.trim();
  if (name) return `Booked (${name})`;
  if (o.takenInitial?.trim()) return `Booked (${o.takenInitial.trim()})`;
  return null;
}

/** Full dropdown option label for a time slot. */
export function optionLabel(o: TakenSlotLabelFields): string {
  if (o.overrideReason === "blocked") return `${o.time} · blocked`;
  if (o.overrideReason === "outside_hours") return `${o.time} · outside hours`;
  const booked = takenSlotBookedLabel(o);
  if (booked) return `${o.time} · ${booked}`;
  if (o.overrideReason === "conflict") return `${o.time} · Booked`;
  return o.time;
}

/** Selected-slot suffix without surrounding parentheses. */
export function selectedTakenSuffix(
  o: Pick<TakenSlotLabelFields, "takenName" | "takenInitial">,
): string | null {
  const name = o.takenName?.trim();
  if (name) return `booked: ${name}`;
  if (o.takenInitial?.trim()) return `booked: ${o.takenInitial.trim()}`;
  return null;
}
