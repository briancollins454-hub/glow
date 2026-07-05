import type { Instrumentation } from "next";

// Server-side error hook: every uncaught error in a request (server components,
// server actions, route handlers) lands here and gets reported to ops.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { reportError } = await import("@/lib/monitor");
  await reportError(err, {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
