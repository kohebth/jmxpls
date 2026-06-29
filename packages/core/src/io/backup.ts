import { copyFile } from "node:fs/promises";

export async function backupFile(path: string): Promise<string> {
  const backupPath = `${path}.${new Date().toISOString().replaceAll(":", "-")}.bak`;
  await copyFile(path, backupPath);
  return backupPath;
}
