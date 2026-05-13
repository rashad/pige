import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { Config } from "./schema.js";
import { CONFIG_VERSION } from "./schema.js";

export function defaultConfigDir(): string {
  return process.env.PIGE_DIR ?? join(homedir(), ".config", "pige");
}

export function configPath(dir: string = defaultConfigDir()): string {
  return join(dir, "config.json");
}

export async function loadConfig(path: string = configPath()): Promise<Config | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Config;
    if (parsed.version !== CONFIG_VERSION) {
      throw new Error(`Unsupported config version ${parsed.version}, expected ${CONFIG_VERSION}`);
    }
    return parsed;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function saveConfig(path: string, cfg: Config): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}
