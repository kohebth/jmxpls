import type { JtlSample } from "./jtl-parser.js";

export type JtlMetrics = {
  samples: number;
  errors: number;
  errorRate: number;
  avg: number;
  min: number;
  max: number;
};

export function computeJtlMetrics(samples: JtlSample[]): JtlMetrics {
  const elapsed = samples.map((sample) => sample.elapsed);
  const errors = samples.filter((sample) => !sample.success).length;
  const total = elapsed.reduce((sum, value) => sum + value, 0);

  return {
    samples: samples.length,
    errors,
    errorRate: samples.length === 0 ? 0 : errors / samples.length,
    avg: samples.length === 0 ? 0 : total / samples.length,
    min: elapsed.length === 0 ? 0 : Math.min(...elapsed),
    max: elapsed.length === 0 ? 0 : Math.max(...elapsed)
  };
}
