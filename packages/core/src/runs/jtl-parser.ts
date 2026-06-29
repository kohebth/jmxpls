export type JtlSample = {
  elapsed: number;
  label: string;
  success: boolean;
  responseCode: string;
};

export function parseJtlCsv(text: string): JtlSample[] {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }
  const headers = headerLine.split(",");
  const index = (name: string) => headers.indexOf(name);

  return lines.filter(Boolean).map((line) => {
    const cols = line.split(",");
    return {
      elapsed: Number(cols[index("elapsed")] ?? 0),
      label: cols[index("label")] ?? "",
      success: (cols[index("success")] ?? "false") === "true",
      responseCode: cols[index("responseCode")] ?? ""
    };
  });
}
