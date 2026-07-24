/** Renders one or more JSON-LD graph objects into a script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const payload = Array.isArray(data) ? data : [data];
  const json = JSON.stringify(payload.length === 1 ? payload[0] : payload).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // JSON-LD is trusted server-built schema, not user HTML.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
