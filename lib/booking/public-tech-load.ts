import { cache } from "react";
import { supabaseService } from "@/lib/supabase/service";
import { getTechByHandle } from "@/lib/db/queries";

/** Deduped per-request tech lookup for public booking routes (layout + page + metadata). */
export const loadPublicTechByHandle = cache(async (handle: string) => {
  return getTechByHandle(supabaseService(), handle);
});
