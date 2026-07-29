import { requireOwner } from "@/lib/owner/require-owner";
import { endViewAsAction } from "../view-as-actions";

/** Dedicated exit path allow-listed in middleware for view-as POSTs. */
export default async function ViewAsExitPage() {
  await requireOwner();
  return (
    <form action={endViewAsAction} className="grid min-h-screen place-items-center">
      <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-white">
        Exit view-as
      </button>
    </form>
  );
}
