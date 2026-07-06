"use client";

import dynamic from "next/dynamic";

export const LazyDateTimePicker = dynamic(
  () => import("@/components/dashboard/date-time-picker").then((m) => m.DateTimePicker),
  {
    ssr: false,
    loading: () => <div className="input h-10 animate-pulse bg-white/[0.04]" />,
  },
);
