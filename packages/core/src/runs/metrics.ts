import type { JtlSample } from "./jtl-parser.js";

export type JtlMetrics = {
  samples: number;
  errors: number;
  errorRate: number;
  throughput: number;
  avg: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  bytes: number;
  sentBytes: number;
  responseCodes: Record<string, number>;
  labels: Record<string, { samples: number; errors: number; avg: number; p95: number }>;
};

export type SlaThresholds = {
  maxErrorRate?: number;
  maxAvgMs?: number;
  maxP95Ms?: number;
  minThroughput?: number;
};

export type SlaCheckResult = {
  passed: boolean;
  failures: string[];
  metrics: JtlMetrics;
};

export type JtlComparison = {
  left: JtlMetrics;
  right: JtlMetrics;
  delta: {
    samples: number;
    errors: number;
    errorRate: number;
    avg: number;
    p95: number;
    throughput: number;
  };
};

export function computeJtlMetrics(samples: JtlSample[]): JtlMetrics {
  const elapsed = samples.map((sample) => sample.elapsed).sort((left, right) => left - right);
  const errors = samples.filter((sample) => !sample.success).length;
  const total = elapsed.reduce((sum, value) => sum + value, 0);
  const bytes = samples.reduce((sum, sample) => sum + (sample.bytes ?? 0), 0);
  const sentBytes = samples.reduce((sum, sample) => sum + (sample.sentBytes ?? 0), 0);

  return {
    samples: samples.length,
    errors,
    errorRate: samples.length === 0 ? 0 : errors / samples.length,
    throughput: throughput(samples),
    avg: samples.length === 0 ? 0 : total / samples.length,
    median: percentile(elapsed, 50),
    p90: percentile(elapsed, 90),
    p95: percentile(elapsed, 95),
    p99: percentile(elapsed, 99),
    min: elapsed.length === 0 ? 0 : elapsed[0] ?? 0,
    max: elapsed.length === 0 ? 0 : elapsed[elapsed.length - 1] ?? 0,
    bytes,
    sentBytes,
    responseCodes: countBy(samples, (sample) => sample.responseCode || "unknown"),
    labels: labelMetrics(samples)
  };
}

export function checkSla(samples: JtlSample[], thresholds: SlaThresholds): SlaCheckResult {
  const metrics = computeJtlMetrics(samples);
  const failures: string[] = [];
  if (thresholds.maxErrorRate !== undefined && metrics.errorRate > thresholds.maxErrorRate) {
    failures.push(`errorRate ${metrics.errorRate} exceeded ${thresholds.maxErrorRate}`);
  }
  if (thresholds.maxAvgMs !== undefined && metrics.avg > thresholds.maxAvgMs) {
    failures.push(`avg ${metrics.avg}ms exceeded ${thresholds.maxAvgMs}ms`);
  }
  if (thresholds.maxP95Ms !== undefined && metrics.p95 > thresholds.maxP95Ms) {
    failures.push(`p95 ${metrics.p95}ms exceeded ${thresholds.maxP95Ms}ms`);
  }
  if (thresholds.minThroughput !== undefined && metrics.throughput < thresholds.minThroughput) {
    failures.push(`throughput ${metrics.throughput} was below ${thresholds.minThroughput}`);
  }
  return { passed: failures.length === 0, failures, metrics };
}

export function compareJtlMetrics(leftSamples: JtlSample[], rightSamples: JtlSample[]): JtlComparison {
  const left = computeJtlMetrics(leftSamples);
  const right = computeJtlMetrics(rightSamples);
  return {
    left,
    right,
    delta: {
      samples: right.samples - left.samples,
      errors: right.errors - left.errors,
      errorRate: right.errorRate - left.errorRate,
      avg: right.avg - left.avg,
      p95: right.p95 - left.p95,
      throughput: right.throughput - left.throughput
    }
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) {
    return sorted[low] ?? 0;
  }
  const lowValue = sorted[low] ?? 0;
  const highValue = sorted[high] ?? lowValue;
  return lowValue + (highValue - lowValue) * (rank - low);
}

function throughput(samples: JtlSample[]): number {
  const timestamps = samples.flatMap((sample) => sample.timeStamp === undefined ? [] : [sample.timeStamp]);
  if (timestamps.length < 2) {
    return 0;
  }
  const durationSeconds = (Math.max(...timestamps) - Math.min(...timestamps)) / 1000;
  return durationSeconds <= 0 ? 0 : samples.length / durationSeconds;
}

function countBy(samples: JtlSample[], key: (sample: JtlSample) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const sample of samples) {
    const value = key(sample);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function labelMetrics(samples: JtlSample[]): JtlMetrics["labels"] {
  const labels: JtlMetrics["labels"] = {};
  for (const label of Object.keys(countBy(samples, (sample) => sample.label || "unknown"))) {
    const group = samples.filter((sample) => (sample.label || "unknown") === label);
    const elapsed = group.map((sample) => sample.elapsed).sort((left, right) => left - right);
    const total = elapsed.reduce((sum, value) => sum + value, 0);
    labels[label] = {
      samples: group.length,
      errors: group.filter((sample) => !sample.success).length,
      avg: group.length === 0 ? 0 : total / group.length,
      p95: percentile(elapsed, 95)
    };
  }
  return labels;
}
