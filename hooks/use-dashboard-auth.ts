"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tech } from "@/lib/db/types";

type MeResponse = { tech: Tech; admin: boolean };

let cachedMe: MeResponse | null = null;
let inflightMe: Promise<MeResponse | null> | null = null;

async function loadMe(): Promise<MeResponse | null> {
  if (cachedMe) return cachedMe;
  if (!inflightMe) {
    inflightMe = fetch("/api/dashboard/me", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) return null;
        if (!r.ok) throw new Error("auth failed");
        return r.json() as Promise<MeResponse>;
      })
      .then((data) => {
        if (data) cachedMe = data;
        return data;
      })
      .finally(() => {
        inflightMe = null;
      });
  }
  return inflightMe;
}

export function useDashboardAuth() {
  const router = useRouter();
  const [state, setState] = useState<{
    tech: Tech | null;
    admin: boolean;
    loading: boolean;
  }>(() =>
    cachedMe
      ? { tech: cachedMe.tech, admin: cachedMe.admin, loading: false }
      : { tech: null, admin: false, loading: true },
  );

  useEffect(() => {
    let cancelled = false;
    loadMe().then((me) => {
      if (cancelled) return;
      if (!me) {
        router.replace("/login");
        return;
      }
      setState({ tech: me.tech, admin: me.admin, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return state;
}

export function invalidateDashboardAuth() {
  cachedMe = null;
}
