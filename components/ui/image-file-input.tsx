"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { ImageTooLargeError, prepareImageForUpload } from "@/lib/image-prepare";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  /** Longest edge the uploaded image is resized to (default 2000px). */
  maxDimension?: number;
};

/**
 * File input that automatically downscales/compresses the chosen image in the
 * browser before the form is submitted, so large phone photos don't blow past
 * the server upload limit.
 */
export function ImageFileInput({ maxDimension, accept, ...props }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setError(null);
    if (!file) return;
    setProcessing(true);
    try {
      const prepared = await prepareImageForUpload(file, { maxDimension });
      if (prepared !== file) {
        const dt = new DataTransfer();
        dt.items.add(prepared);
        input.files = dt.files;
      }
    } catch (err) {
      input.value = "";
      setError(
        err instanceof ImageTooLargeError
          ? "That photo is too large. Please choose an image under 8MB."
          : "We couldn't read that image. Try a JPG, PNG or WebP instead.",
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <input
        type="file"
        accept={accept ?? "image/jpeg,image/png,image/webp"}
        onChange={onChange}
        {...props}
      />
      {processing && <p className="mt-1 text-xs text-ink-faint">Optimising photo…</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </>
  );
}
