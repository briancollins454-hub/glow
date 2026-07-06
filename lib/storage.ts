import { unstable_cache } from "next/cache";
import { supabaseService } from "@/lib/supabase/service";

const BUCKET = "client-photos";

export async function uploadPhoto(
  path: string,
  bytes: Uint8Array,
  contentType: string,
  opts: { upsert?: boolean } = {},
): Promise<void> {
  const { error } = await supabaseService()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType, upsert: opts.upsert ?? false });
  if (error) throw new Error(error.message);
}

async function createSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabaseService()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

const cachedSignedUrl = unstable_cache(
  async (path: string) => createSignedUrl(path),
  ["signed-photo-url"],
  { revalidate: 3600 },
);

export async function signedPhotoUrl(path: string): Promise<string | null> {
  return cachedSignedUrl(path);
}

/** Sign many storage paths in parallel (deduped, cached). */
export async function signedPhotoUrls(
  paths: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (path) => {
      const url = await signedPhotoUrl(path);
      return url ? ([path, url] as const) : null;
    }),
  );
  return new Map(entries.filter((e): e is [string, string] => e !== null));
}

export async function removePhoto(path: string): Promise<void> {
  await supabaseService().storage.from(BUCKET).remove([path]);
}
