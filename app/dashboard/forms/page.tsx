"use client";

import { Plus, Trash2, ClipboardList, FolderPlus } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PackScopePicker } from "@/components/dashboard/pack-scope-picker";
import {
  addPackQuestionAction,
  createConsultationPackAction,
  deleteConsultationPackAction,
  deleteQuestionAction,
  updateConsultationPackAction,
} from "../actions";
import {
  ALL_SERVICES_PACK_NAME,
  groupQuestionsByPack,
  packScopeLabel,
} from "@/lib/booking/consultation-scope";
import type {
  ConsultationPack,
  ConsultationPackTarget,
  ConsultationQuestion,
  Service,
  ServiceCategory,
} from "@/lib/db/types";

const typeLabel: Record<string, string> = {
  text: "Short text",
  longtext: "Long text",
  yesno: "Yes / No",
};

type FormsData = {
  packs: ConsultationPack[];
  targets: ConsultationPackTarget[];
  questions: ConsultationQuestion[];
  categories: ServiceCategory[];
  services: Service[];
};

export default function FormsPage() {
  return (
    <AsyncDashboardPage<FormsData> pageKey="forms">
      {(data) => <FormsView {...data} />}
    </AsyncDashboardPage>
  );
}

function FormsView({ packs, targets, questions, categories, services }: FormsData) {
  const activeServices = services.filter((s) => s.active);
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const svcById = new Map(services.map((s) => [s.id, s.name]));
  const targetsByPack = new Map<string, ConsultationPackTarget[]>();
  for (const t of targets) {
    const list = targetsByPack.get(t.packId) ?? [];
    list.push(t);
    targetsByPack.set(t.packId, list);
  }
  const grouped = groupQuestionsByPack(packs, questions);
  const legacyOrphans = questions.filter((q) => !q.packId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Consultation forms</h1>
        <p className="text-sm text-ink-soft">
          Build a form once, then show it for whole categories and/or specific services. New services
          in a chosen category pick up that form automatically — you do not rewrite the same question
          for every treatment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-brand-400" /> New form
          </CardTitle>
          <CardDescription>
            Example: “Piercing consultation” shown for the Piercings category. Add as many questions
            as you need under that form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createConsultationPackAction} className="grid gap-3 sm:grid-cols-[1fr_minmax(0,1.2fr)_auto] sm:items-end">
            <div>
              <Label>Form name</Label>
              <Input name="name" placeholder="Piercing consultation" required />
            </div>
            <div className="min-w-0">
              <Label>Shown for</Label>
              <PackScopePicker categories={categories} services={activeServices} />
            </div>
            <Button type="submit" variant="secondary">Create form</Button>
          </form>
        </CardContent>
      </Card>

      {grouped.length === 0 && legacyOrphans.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-ink-faint">
            No forms yet. Create one above, or add questions to the default “{ALL_SERVICES_PACK_NAME}”
            form once it appears.
          </CardContent>
        </Card>
      )}

      {grouped.map(({ pack, questions: packQuestions }) => {
        const packTargets = targetsByPack.get(pack.id) ?? [];
        const scopeDefault = packTargets.map((t) =>
          t.serviceId ? `service:${t.serviceId}` : `category:${t.categoryId}`,
        );
        const scopeText = packScopeLabel(packTargets, {
          categoryName: (id) => catById.get(id),
          serviceName: (id) => svcById.get(id),
        });
        const isAllPack = pack.name === ALL_SERVICES_PACK_NAME && packTargets.length === 0;

        return (
          <Card key={pack.id}>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-brand-400" />
                    {pack.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Shown for <span className="font-medium text-ink-soft">{scopeText}</span>
                    {" · "}
                    {packQuestions.length} question{packQuestions.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                {!isAllPack && (
                  <form action={deleteConsultationPackAction}>
                    <input type="hidden" name="id" value={pack.id} />
                    <button
                      type="submit"
                      className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400"
                      title="Delete this form and its questions"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>

              <form action={updateConsultationPackAction} className="grid gap-3 border-t border-edge pt-3 sm:grid-cols-[1fr_minmax(0,1.4fr)_auto] sm:items-end">
                <input type="hidden" name="id" value={pack.id} />
                <div>
                  <Label>Form name</Label>
                  <Input name="name" defaultValue={pack.name} required />
                </div>
                <div className="min-w-0">
                  <Label>Shown for</Label>
                  <PackScopePicker
                    categories={categories}
                    services={activeServices}
                    defaultSelected={scopeDefault}
                  />
                </div>
                <Button type="submit" variant="secondary">Save</Button>
              </form>
            </CardHeader>

            <CardContent className="space-y-4">
              <form
                action={addPackQuestionAction}
                className="grid gap-3 rounded-xl border border-edge bg-cream/50 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
              >
                <input type="hidden" name="packId" value={pack.id} />
                <div className="sm:col-span-1">
                  <Label>Add a question</Label>
                  <Input name="prompt" placeholder="Any allergies or skin sensitivities?" required />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select name="type" defaultValue="text">
                    <option value="text">Short text</option>
                    <option value="longtext">Long text</option>
                    <option value="yesno">Yes / No</option>
                  </Select>
                </div>
                <label className="flex items-center gap-2 pb-2.5 text-sm">
                  <input
                    type="checkbox"
                    name="required"
                    className="h-4 w-4 rounded border-edge text-brand-400 focus:ring-brand-300"
                  />{" "}
                  Required
                </label>
                <Button type="submit" variant="secondary">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </form>

              {packQuestions.length === 0 ? (
                <p className="text-sm text-ink-faint">No questions in this form yet.</p>
              ) : (
                <div className="space-y-2">
                  {packQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{q.prompt}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                          <Badge tone="neutral">{typeLabel[q.type] ?? q.type}</Badge>
                          {q.required && <Badge tone="amber">Required</Badge>}
                        </p>
                      </div>
                      <form action={deleteQuestionAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <button
                          type="submit"
                          className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {legacyOrphans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unassigned questions</CardTitle>
            <CardDescription>
              These predate form packs. Refresh the page after migration to place them automatically,
              or delete and recreate under a form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {legacyOrphans.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-cream px-4 py-3"
              >
                <p className="font-medium">{q.prompt}</p>
                <form action={deleteQuestionAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <button
                    type="submit"
                    className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
