"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { AsyncDashboardPage } from "@/components/dashboard/async-dashboard-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitFeedbackAction } from "../actions";

export default function FeedbackPage() {
  return (
    <AsyncDashboardPage<Record<string, never>> pageKey="feedback">
      {() => <FeedbackView />}
    </AsyncDashboardPage>
  );
}

function FeedbackView() {
  const searchParams = useSearchParams();
  const sent = searchParams.get("sent");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Lightbulb className="h-6 w-6 text-brand-400" /> Share an idea
        </h1>
        <p className="text-sm text-ink-soft">
          Spotted something annoying? Wish Glow did something it doesn&apos;t? Tell us - a real
          person reads every message, and the best ideas get built.
        </p>
      </div>

      {sent && (
        <div className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-text">
          <CheckCircle2 className="h-4 w-4" /> Sent - thank you! If we build it, you&apos;ll be the first to know.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s on your mind?</CardTitle>
          <CardDescription>The more detail the better - screenshots can go to support@glow-uk.com.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitFeedbackAction} className="space-y-4">
            <div>
              <Label>What&apos;s it about?</Label>
              <Select name="topic" defaultValue="idea">
                <option value="idea">A new idea / feature request</option>
                <option value="annoying">Something is annoying or confusing</option>
                <option value="broken">Something looks broken</option>
                <option value="other">Something else</option>
              </Select>
            </div>
            <div>
              <Label>Tell us about it</Label>
              <Textarea
                name="message"
                required
                minLength={10}
                className="min-h-[140px]"
                placeholder="e.g. It would be great if clients could pay in instalments…"
              />
            </div>
            <SubmitButton pendingLabel="Sending…">Send it</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
