"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, UserPlus, UsersRound } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import type { Service, StaffMember, WorkingHour } from "@/lib/db/types";
import {
  createStaffAction,
  resetStaffPasswordAction,
  saveStaffHoursAction,
  setStaffActiveAction,
  setStaffLoginAction,
  updateStaffDetailsAction,
} from "./actions";
import { StaffRotaEditor } from "@/components/dashboard/staff-rota";

const DAYS = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
];

const ERRORS: Record<string, string> = {
  missing: "Please fill in the required fields.",
  email: "An account with that email already exists.",
  password: "Passwords need at least 8 characters.",
  owner: "The owner can't be deactivated.",
  haslogin: "This person already has a login. Use Reset password instead.",
};

function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

type TeamData =
  | { forbidden: true }
  | { unavailable: true }
  | {
      staff: StaffMember[];
      services: Service[];
      restrictions: Record<string, string[]>;
      hoursByStaff: Record<string, WorkingHour[]>;
      flexibleHoursEnabled?: boolean;
    };

export default function TeamPage() {
  return (
    <AsyncDashboardPage<TeamData> pageKey="team">
      {(data) => <TeamGate data={data} />}
    </AsyncDashboardPage>
  );
}

function TeamGate({ data }: { data: TeamData }) {
  if ("forbidden" in data) {
    return <p className="text-sm text-ink-soft">You don&apos;t have access to team settings.</p>;
  }
  if ("unavailable" in data) {
    return (
      <p className="text-sm text-ink-soft">
        Team features aren&apos;t switched on for this environment yet.
      </p>
    );
  }
  return <TeamView {...data} />;
}

function TeamView({
  staff,
  services,
  restrictions,
  hoursByStaff,
  flexibleHoursEnabled,
}: {
  staff: StaffMember[];
  services: Service[];
  restrictions: Record<string, string[]>;
  hoursByStaff: Record<string, WorkingHour[]>;
  flexibleHoursEnabled?: boolean;
}) {
  const searchParams = useSearchParams();
  const saved = searchParams.get("saved");
  const err = searchParams.get("err");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <UsersRound className="h-6 w-6 text-brand-400" /> Team
        </h1>
        <p className="text-sm text-ink-soft">
          Add staff with their own calendars. Clients pick a person (or &quot;any available&quot;)
          when they book. Unlimited staff, included in your plan.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Saved.
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {ERRORS[err] ?? "Something went wrong. Please try again."}
        </div>
      )}

      {flexibleHoursEnabled && (
        <div className="rounded-xl border border-edge bg-cream px-4 py-3 text-sm text-ink-soft">
          Flexible hours are on (Opening hours → &quot;My days change each week&quot;). Online booking
          uses that daily window unless you save a <span className="font-medium text-ink">Week
          rota</span> for someone below. A saved rota week wins for that person.
        </div>
      )}

      {staff.map((member) => (
        <StaffCard
          key={member.id}
          member={member}
          services={services}
          restricted={restrictions[member.id] ?? []}
          hours={hoursByStaff[member.id] ?? []}
        />
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add a staff member
          </CardTitle>
          <CardDescription>
            They start with Tue-Sat 9-5 hours (change below after adding). Give them an email and
            password to let them log in and see the diary - or leave both blank for a diary-only
            person you manage yourself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createStaffAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" name="name" required placeholder="Amy" />
              </div>
              <div>
                <Label htmlFor="new-email">Login email (optional)</Label>
                <Input id="new-email" name="email" type="email" placeholder="amy@example.com" />
              </div>
              <div>
                <Label htmlFor="new-password">Login password (optional)</Label>
                <Input id="new-password" name="password" type="password" placeholder="Min 8 characters" />
              </div>
            </div>
            <ServicesPicker services={services} restricted={[]} idPrefix="new" />
            <Button type="submit">
              <UserPlus className="h-4 w-4" /> Add staff member
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ServicesPicker({
  services,
  restricted,
  idPrefix,
}: {
  services: Service[];
  restricted: string[];
  idPrefix: string;
}) {
  const doesAll = restricted.length === 0;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Treatments they perform</p>
      <label className="flex items-center gap-2.5 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="allServices"
          defaultChecked={doesAll}
          className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
        />
        All treatments (including ones added later)
      </label>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {services.map((s) => (
          <label
            key={`${idPrefix}-${s.id}`}
            className="flex items-center gap-2.5 rounded-lg border border-edge bg-cream px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name={`svc_${s.id}`}
              defaultChecked={!doesAll && restricted.includes(s.id)}
              className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
            />
            {s.name}
          </label>
        ))}
      </div>
      <p className="text-xs text-ink-faint">
        Untick &quot;All treatments&quot; and pick specific ones to limit what clients can book with
        this person.
      </p>
    </div>
  );
}

function StaffCard({
  member,
  services,
  restricted,
  hours,
}: {
  member: StaffMember;
  services: Service[];
  restricted: string[];
  hours: WorkingHour[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {member.name}
          {member.role === "owner" && <Badge tone="brand">Owner</Badge>}
          {!member.active && <Badge tone="neutral">Inactive</Badge>}
          {member.authUserId ? (
            <Badge tone="green">Has login</Badge>
          ) : (
            <Badge tone="neutral">No login</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {member.email || "No email"} ·{" "}
          {restricted.length === 0
            ? "performs all treatments"
            : `performs ${restricted.length} treatment${restricted.length === 1 ? "" : "s"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <details className="rounded-xl border border-edge">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-soft transition hover:text-ink [&::-webkit-details-marker]:hidden">
            Name &amp; treatments
          </summary>
          <form action={updateStaffDetailsAction} className="space-y-4 border-t border-edge p-4">
            <input type="hidden" name="id" value={member.id} />
            <div className="max-w-sm">
              <Label htmlFor={`name-${member.id}`}>Name</Label>
              <Input id={`name-${member.id}`} name="name" defaultValue={member.name} />
            </div>
            <ServicesPicker services={services} restricted={restricted} idPrefix={member.id} />
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        </details>

        <details className="rounded-xl border border-edge">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-soft transition hover:text-ink [&::-webkit-details-marker]:hidden">
            Week rota
          </summary>
          <StaffRotaEditor staffId={member.id} templateHours={hours} />
        </details>

        <details className="rounded-xl border border-edge">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-soft transition hover:text-ink [&::-webkit-details-marker]:hidden">
            Usual weekly hours
          </summary>
          <form action={saveStaffHoursAction} className="space-y-3 border-t border-edge p-4">
            <input type="hidden" name="id" value={member.id} />
            <p className="text-sm text-ink-soft">
              Default Mon–Sun pattern used when a week has no rota saved.
            </p>
            {DAYS.map(({ weekday, label }) => {
              const row = hours.find((h) => h.weekday === weekday);
              return (
                <div
                  key={weekday}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-cream px-4 py-3"
                >
                  <label className="flex w-36 items-center gap-2.5">
                    <input
                      type="checkbox"
                      name={`enabled_${weekday}`}
                      defaultChecked={row?.enabled ?? false}
                      className="h-4 w-4 rounded border-black/20 text-brand-400 focus:ring-brand-300"
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="time"
                      name={`start_${weekday}`}
                      defaultValue={minToHHMM(row?.startMinutes ?? 540)}
                      className="input h-10 w-32"
                    />
                    <span>to</span>
                    <input
                      type="time"
                      name={`end_${weekday}`}
                      defaultValue={minToHHMM(row?.endMinutes ?? 1020)}
                      className="input h-10 w-32"
                    />
                  </div>
                </div>
              );
            })}
            <Button type="submit" variant="secondary">Save hours</Button>
          </form>
        </details>

        {!member.authUserId && member.role !== "owner" && (
          <details className="rounded-xl border border-edge" open>
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-soft transition hover:text-ink [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Add login
              </span>
            </summary>
            <form action={setStaffLoginAction} className="space-y-3 border-t border-edge p-4">
              <input type="hidden" name="id" value={member.id} />
              <p className="text-sm text-ink-soft">
                Optional. Only needed if this person should sign in with their own email. For one
                shared salon login, skip this and use the owner account instead.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`login-email-${member.id}`}>Login email</Label>
                  <Input
                    id={`login-email-${member.id}`}
                    name="email"
                    type="email"
                    required
                    defaultValue={member.email || undefined}
                    placeholder="amy@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor={`login-pw-${member.id}`}>Password</Label>
                  <Input
                    id={`login-pw-${member.id}`}
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                  />
                </div>
              </div>
              <Button type="submit" variant="secondary">
                <KeyRound className="h-4 w-4" /> Create login
              </Button>
            </form>
          </details>
        )}

        {member.authUserId && (
          <details className="rounded-xl border border-edge">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-soft transition hover:text-ink [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Reset their password
              </span>
            </summary>
            <form
              action={resetStaffPasswordAction}
              className="flex flex-wrap items-end gap-3 border-t border-edge p-4"
            >
              <input type="hidden" name="id" value={member.id} />
              <div>
                <Label htmlFor={`pw-${member.id}`}>New password</Label>
                <Input
                  id={`pw-${member.id}`}
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" variant="secondary">Set password</Button>
            </form>
          </details>
        )}

        {member.role !== "owner" && (
          <form action={setStaffActiveAction}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="active" value={member.active ? "0" : "1"} />
            <button
              type="submit"
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-white/[0.1]"
            >
              {member.active ? "Deactivate (hide from booking page)" : "Reactivate"}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
