"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import {
  removeBrandCoverAction,
  removeBrandProfileAction,
  uploadBrandCoverAction,
  uploadBrandProfileAction,
} from "@/app/dashboard/actions";
import { invalidateDashboardAuth } from "@/hooks/use-dashboard-auth";
import type { DashboardTech } from "@/lib/db/types";

type BrandUrls = { cover: string | null; profile: string | null };

export function PageBrandingUploads({ tech }: { tech: DashboardTech }) {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const [uploading, startUpload] = useTransition();

  const aspectClass = aspect === "square" ? "aspect-square max-w-[220px]" : "aspect-[16/9] w-full";
  const previewUrl = localPreview ?? url;

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  function onPickFile(file: File | undefined) {
    setError(null);
    if (!file) {
      setSelectedName(null);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    setSelectedName(file.name);
    setLocalPreview(URL.createObjectURL(file));
  }

  function onUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a photo first, then tap Upload.");
      return;
    }
    const fd = new FormData();
    fd.append(inputName, file);
    startUpload(async () => {
      try {
        await uploadAction(fd);
      } catch {
        setError("Upload failed. Try a JPG, PNG or WebP under 10MB.");
      }
    });
  }

  function onRemove() {
    startRemove(async () => {
      try {
        await removeAction();
      } catch {
        setError("Could not remove the image. Try again.");
      }
    });
  }

  const busy = uploading || removing;

  return (
    <div className="rounded-xl border border-edge bg-cream p-4 sm:p-5">
      <Label>{label}</Label>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">{hint}</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-edge bg-surface">
        {previewUrl ? (
          <div className={`relative ${aspectClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className={`flex ${aspectClass} flex-col items-center justify-center gap-2 text-ink-faint`}>
            <ImageIcon className="h-10 w-10 opacity-40" />
            <span className="text-sm">No image uploaded</span>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        name={inputName}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => onPickFile(e.target.files?.[0])}
      />

      <div className="mt-4 flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
          {selectedName ? "Choose a different photo" : "Choose photo"}
        </Button>

        {selectedName && (
          <p className="truncate text-center text-xs text-ink-soft">Selected: {selectedName}</p>
        )}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={busy || !selectedName}
          onClick={onUpload}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Upload photo
            </>
          )}
        </Button>

        {url && (
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            disabled={busy}
            onClick={onRemove}
          >
            {removing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Removing…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Remove current photo
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
