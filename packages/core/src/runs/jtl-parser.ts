export type JtlSample = {
  elapsed: number;
  label: string;
  success: boolean;
  responseCode: string;
  timeStamp?: number;
  bytes?: number;
  sentBytes?: number;
  threadName?: string;
};

export function parseJtlCsv(text: string): JtlSample[] {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }
  const headers = parseCsvLine(headerLine);
  const index = (name: string) => headers.indexOf(name);

  return lines.filter(Boolean).map((line) => {
    const cols = parseCsvLine(line);
    const optionalNumber = (name: string): number | undefined => {
      const value = cols[index(name)];
      if (value === undefined || value.length === 0) {
        return undefined;
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : undefined;
    };
    const sample: JtlSample = {
      elapsed: optionalNumber("elapsed") ?? 0,
      label: cols[index("label")] ?? "",
      success: (cols[index("success")] ?? "false") === "true",
      responseCode: cols[index("responseCode")] ?? ""
    };
    const timeStamp = optionalNumber("timeStamp");
    const bytes = optionalNumber("bytes");
    const sentBytes = optionalNumber("sentBytes");
    const threadName = cols[index("threadName")];
    if (timeStamp !== undefined) {
      sample.timeStamp = timeStamp;
    }
    if (bytes !== undefined) {
      sample.bytes = bytes;
    }
    if (sentBytes !== undefined) {
      sample.sentBytes = sentBytes;
    }
    if (threadName !== undefined) {
      sample.threadName = threadName;
    }
    return sample;
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}
