import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultConfigDir } from "./store.js";

const SERVICE = "freelance-cal";
const ACCOUNT = "solidtime-token";
const ENV_VAR = "FREELANCE_SOLIDTIME_TOKEN";

type KeytarLike = {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

let keytarMod: KeytarLike | null | undefined;

async function loadKeytar(): Promise<KeytarLike | null> {
  if (keytarMod !== undefined) return keytarMod;
  try {
    const mod = await import("keytar");
    keytarMod = mod.default as KeytarLike;
  } catch {
    keytarMod = null;
  }
  return keytarMod;
}

function fallbackTokenPath(): string {
  return join(defaultConfigDir(), "token");
}

export async function getToken(): Promise<string | null> {
  const envToken = process.env[ENV_VAR];
  if (envToken && envToken.length > 0) return envToken;

  const kt = await loadKeytar();
  if (kt) {
    try {
      const tok = await kt.getPassword(SERVICE, ACCOUNT);
      if (tok) return tok;
    } catch {
      // fall through to file
    }
  }

  try {
    const tok = (await readFile(fallbackTokenPath(), "utf8")).trim();
    return tok.length > 0 ? tok : null;
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<{ backend: "keychain" | "file" }> {
  const kt = await loadKeytar();
  if (kt) {
    try {
      await kt.setPassword(SERVICE, ACCOUNT, token);
      return { backend: "keychain" };
    } catch {
      // fall through
    }
  }
  const path = fallbackTokenPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, token, { mode: 0o600 });
  await chmod(path, 0o600);
  return { backend: "file" };
}

export async function deleteToken(): Promise<void> {
  const kt = await loadKeytar();
  if (kt) {
    try { await kt.deletePassword(SERVICE, ACCOUNT); } catch { /* ignore */ }
  }
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(fallbackTokenPath());
  } catch { /* ignore */ }
}
