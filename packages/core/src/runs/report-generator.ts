import type { JtlMetrics } from "./metrics.js";

export function renderMetricsReport(metrics: JtlMetrics): string {
  return [
    `samples=${metrics.samples}`,
    `errors=${metrics.errors}`,
    `errorRate=${metrics.errorRate}`,
    `throughput=${metrics.throughput}`,
    `avg=${metrics.avg}`,
    `median=${metrics.median}`,
    `p90=${metrics.p90}`,
    `p95=${metrics.p95}`,
    `p99=${metrics.p99}`,
    `min=${metrics.min}`,
    `max=${metrics.max}`,
    `bytes=${metrics.bytes}`,
    `sentBytes=${metrics.sentBytes}`,
    `responseCodes=${JSON.stringify(metrics.responseCodes)}`,
    `labels=${JSON.stringify(metrics.labels)}`
  ].join("\n") + "\n";
}
