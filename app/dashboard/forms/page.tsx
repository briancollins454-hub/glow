import { redirect } from "next/navigation";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { getDashboardContext } from "@/lib/auth/session";
import { listQuestions } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addQuestionAction, deleteQuestionAction } from "../actions";

const typeLabel: Record<string, string> = {
  text: "Short text",
  longtext: "Long text",
  yesno: "Yes / No",
};

export default async function FormsPage() {
  const c = await getDashboardContext();
  if (!c) redirect("/login");
  const { sb, tech } = c;
  const questions = await listQuestions(sb, tech.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Consultation form</h1>
        <p className="text-sm text-ink-soft">
          Questions clients answer when they book (allergies, medical, preferences).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-brand-600" /> Add a question</CardTitle>
          <CardDescription>Shown on your booking page before payment.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addQuestionAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div>
              <Label>Question</Label>
              <Input name="prompt" placeholder="Any allergies or skin sensitivities?" required />
            </div>
            <div>
              <Label>Answer type</Label>
              <Select name="type" defaultValue="text">
                <option value="text">Short text</option>
                <option value="longtext">Long text</option>
                <option value="yesno">Yes / No</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm">
              <input type="checkbox" name="required" className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-300" /> Required
            </label>
            <Button type="submit" variant="secondary">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-brand-600" /> Your questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {questions.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">No questions yet — your booking page skips the consultation step.</p>
          )}
          {questions.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-cream px-4 py-3">
              <div>
                <p className="font-medium">{q.prompt}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                  <Badge tone="neutral">{typeLabel[q.type] ?? q.type}</Badge>
                  {q.required && <Badge tone="amber">Required</Badge>}
                </p>
              </div>
              <form action={deleteQuestionAction}>
                <input type="hidden" name="id" value={q.id} />
                <button type="submit" className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
