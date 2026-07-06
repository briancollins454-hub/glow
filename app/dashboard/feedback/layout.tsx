import type { Metadata } from "next";

export const metadata: Metadata = { title: "Share an idea" };

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
