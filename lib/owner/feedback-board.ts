/**
 * Feedback / roadmap board (Phase 2.9).
 */

import { supabaseService } from "@/lib/supabase/service";
import { filterOutInternal, shouldIncludeInternal } from "@/lib/owner/internal-accounts";
import type { Tech } from "@/lib/db/types";

export type RoadmapStatus = "open" | "planned" | "shipped" | "declined";

export type FeedbackTheme = {
  themeKey: string;
  title: string;
  status: RoadmapStatus;
  requesterCount: number;
  requesters: { techId: string; label: string; handle: string }[];
  sampleMessage: string;
  ids: string[];
  updatedAt: string;
};

export type FeedbackBoard = {
  themes: FeedbackTheme[];
  generatedAt: string;
};

const LEGACY_MAP: Record<string, RoadmapStatus> = {
  new: "open",
  reviewing: "planned",
  done: "shipped",
  open: "open",
  planned: "planned",
  shipped: "shipped",
  declined: "declined",
};

export function normaliseThemeKey(topic: string, message: string): string {
  const base = `${topic} ${message}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return base || "general";
}

export function mapFeedbackStatus(status: string): RoadmapStatus {
  return LEGACY_MAP[status] ?? "open";
}

/** Aggregate requester counts — strongest prioritisation signal. */
export function aggregateFeedbackThemes(
  rows: {
    id: string;
    techId: string;
    topic: string;
    message: string;
    status: string;
    themeKey?: string | null;
    updatedAt?: string;
    createdAt: string;
  }[],
  techById: Map<string, Pick<Tech, "id" | "businessName" | "handle" | "isInternal">>,
): FeedbackTheme[] {
  const groups = new Map<
    string,
    {
      title: string;
      statuses: RoadmapStatus[];
      ids: string[];
      techIds: Set<string>;
      sample: string;
      updatedAt: string;
    }
  >();

  for (const r of rows) {
    const key = r.themeKey || normaliseThemeKey(r.topic, r.message);
    const cur = groups.get(key) ?? {
      title: r.topic || key.slice(0, 60),
      statuses: [] as RoadmapStatus[],
      ids: [] as string[],
      techIds: new Set<string>(),
      sample: r.message,
      updatedAt: r.updatedAt || r.createdAt,
    };
    cur.statuses.push(mapFeedbackStatus(r.status));
    cur.ids.push(r.id);
    if (techById.has(r.techId)) cur.techIds.add(r.techId);
    if ((r.updatedAt || r.createdAt) > cur.updatedAt) cur.updatedAt = r.updatedAt || r.createdAt;
    groups.set(key, cur);
  }

  const themes: FeedbackTheme[] = [];
  for (const [themeKey, g] of groups) {
    // Prefer most "advanced" status among items
    const order: RoadmapStatus[] = ["shipped", "declined", "planned", "open"];
    let status: RoadmapStatus = "open";
    for (const s of order) {
      if (g.statuses.includes(s)) {
        status = s;
        break;
      }
    }
    const requesters = [...g.techIds].map((id) => {
      const t = techById.get(id)!;
      return { techId: id, label: t.businessName || t.handle, handle: t.handle };
    });
    themes.push({
      themeKey,
      title: g.title,
      status,
      requesterCount: requesters.length,
      requesters,
      sampleMessage: g.sample.slice(0, 280),
      ids: g.ids,
      updatedAt: g.updatedAt,
    });
  }

  return themes.sort((a, b) => b.requesterCount - a.requesterCount || b.updatedAt.localeCompare(a.updatedAt));
}

export async function getFeedbackBoard(): Promise<FeedbackBoard> {
  const sb = supabaseService();
  const includeInternal = await shouldIncludeInternal(sb);
  const { data: techs } = await sb
    .from("techs")
    .select("id, businessName, handle, isInternal")
    .limit(5000);
  const filtered = filterOutInternal((techs ?? []) as Tech[], includeInternal);
  const techById = new Map(filtered.map((t) => [t.id, t]));

  const { data: rows } = await sb
    .from("feedback_submissions")
    .select("id, techId, topic, message, status, themeKey, updatedAt, createdAt")
    .order("createdAt", { ascending: false })
    .limit(1000);

  const visible = (rows ?? []).filter((r) => techById.has(r.techId) || includeInternal);
  const themes = aggregateFeedbackThemes(visible as never, techById);
  return { themes, generatedAt: new Date().toISOString() };
}

export async function setFeedbackThemeStatus(opts: {
  ids: string[];
  status: RoadmapStatus;
  themeKey: string;
}): Promise<void> {
  const sb = supabaseService();
  await sb
    .from("feedback_submissions")
    .update({ status: opts.status, themeKey: opts.themeKey, updatedAt: new Date().toISOString() })
    .in("id", opts.ids);
}
