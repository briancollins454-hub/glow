"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

type DateTimePickerProps = ComponentProps<
  typeof import("@/components/dashboard/date-time-picker").DateTimePicker
>;

export const LazyDateTimePicker = dynamic<DateTimePickerProps>(
  () => import("@/components/dashboard/date-time-picker").then((m) => m.DateTimePicker),
  {
    ssr: false,
    loading: () => <div className="input h-10 animate-pulse bg-fill" />,
  },
);
