/** Large Acuity CSV imports need a longer serverless window than the default. */
export const maxDuration = 300;

export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
