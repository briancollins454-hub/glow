"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import {
  removeBrandCoverAction,
  removeBrandProfileAction,
  uploadBrandCoverAction,
  uploadBrandProfileAction,
} from "@/app/dashboard/actions";
import { invalidateDashboardAuth } from "@/hooks/use-dashboard-auth";
import type { Tech } from "@/lib/db/types";

type BrandUrls = { cover: string | null; profile: string | null };

export function PageBrandingUploads({ tech }: { tech: Tech }) {
  const searchParams = useSearchParams();
  const [urls, setUrls] = useState<BrandUrls>({ cover: null, profile: null });

  useEffect(() => {
    const refresh = searchParams.get("cover") || searchParams.get("profile") || searchParams.get("saved");
    if (refresh) invalidateDashboardAuth();
    fetch("/api/dashboard/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setUrls({
          cover: data.brandCoverUrl ?? null,
          profile: data.brandProfileUrl ?? null,
        });
      })
      .catch(() => {});
  }, [searchParams, tech.coverPhotoPath, tech.profilePhotoPath]);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <PhotoUpload
        label="Banner image"
        hint="Wide landscape photo works best (like a website header). Shown full-width at the top of your page."
        url={urls.cover}
        inputName="cover"
        uploadAction={uploadBrandCoverAction}
        removeAction={removeBrandCoverAction}
      />
      <PhotoUpload
        label="Profile photo"
        hint="Square headshot or logo. Shown in your page header next to your business name."
        url={urls.profile}
        inputName="profile"
        aspect="square"
        uploadAction={uploadBrandProfileAction}
        removeAction={removeBrandProfileAction}
      />
    </div>
  );
}

function PhotoUpload({
  label,
  hint,
  url,
  inputName,
  aspect = "banner",
  uploadAction,
  removeAction,
}: {
  label: string;
  hint: string;
  url: string | null;
  inputName: string;
  aspect?: "banner" | "square";
  uploadAction: (formData: FormData) => Promise<void>;
  removeAction: () => Promise<void>;
}) {
  const aspectClass = aspect === "square" ? "aspect-square max-w-[200px]" : "aspect-[16/9] w-full";
  return (
    <div className="rounded-xl border border-edge bg-cream p-4">
      <Label>{label}</Label>
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-edge bg-surface">
        {url ? (
          <div className={`relative ${aspectClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className={`flex ${aspectClass} flex-col items-center justify-center gap-2 text-ink-faint`}>
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="text-xs">No image uploaded</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={uploadAction} className="flex items-center gap-2">
          <input
            type="file"
            name={inputName}
            accept="image/jpeg,image/png,image/webp"
            className="max-w-[12rem] text-xs text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
          />
          <Button type="submit" size="sm" variant="secondary">
            Upload
          </Button>
        </form>
        {url && (
          <form action={removeAction}>
            <Button type="submit" size="sm" variant="outline">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
