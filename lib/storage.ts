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

export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabaseService()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function removePhoto(path: string): Promise<void> {
  await supabaseService().storage.from(BUCKET).remove([path]);
}
