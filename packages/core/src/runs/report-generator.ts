import type { JtlMetrics } from "./metrics.js";

export function renderMetricsReport(metrics: JtlMetrics): string {
  return `samples=${metrics.samples}\nerrors=${metrics.errors}\nerrorRate=${metrics.errorRate}\navg=${metrics.avg}\nmin=${metrics.min}\nmax=${metrics.max}\n`;
}
