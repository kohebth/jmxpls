import { rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export async function atomicWriteFile(path: string, content: string): Promise<string> {
  const tempPath = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, path);
  return path;
}
