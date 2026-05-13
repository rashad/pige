import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultConfigDir } from "./store.js";

const SERVICE = "pige";
const ACCOUNT = "solidtime-token";
const ENV_VAR = "PIGE_SOLIDTIME_TOKEN";

// Shape of the napi-rs/keyring `Entry` class we depend on. Wrapped behind this
// type so the rest of the module doesn't import from the dynamic import target.
type KeyringEntry = {
  setPassword(password: string): void;
  getPassword(): string | null;
  deletePassword(): boolean;
};

type KeyringMod = {
  Entry: new (service: string, account: string) => KeyringEntry;
};

let keyringMod: KeyringMod | null | undefined;

async function loadKeyring(): Promise<KeyringMod | null> {
  if (keyringMod !== undefined) return keyringMod;
  try {
    keyringMod = (await import("@napi-rs/keyring")) as unknown as KeyringMod;
  } catch {
    keyringMod = null;
  }
  return keyringMod;
}

function makeEntry(mod: KeyringMod): KeyringEntry {
  return new mod.Entry(SERVICE, ACCOUNT);
}

function fallbackTokenPath(): string {
  return join(defaultConfigDir(), "token");
}

export async function getToken(): Promise<string | null> {
  const envToken = process.env[ENV_VAR];
  if (envToken && envToken.length > 0) return envToken;

  const mod = await loadKeyring();
  if (mod) {
    try {
      const tok = makeEntry(mod).getPassword();
      if (tok) return tok;
    } catch {
      // NoEntry / Ambiguous / OS error — fall through to file fallback.
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
  const mod = await loadKeyring();
  if (mod) {
    try {
      makeEntry(mod).setPassword(token);
      return { backend: "keychain" };
    } catch {
      // fall through to file
    }
  }
  const path = fallbackTokenPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, token, { mode: 0o600 });
  await chmod(path, 0o600);
  return { backend: "file" };
}

export async function deleteToken(): Promise<void> {
  const mod = await loadKeyring();
  if (mod) {
    try {
      makeEntry(mod).deletePassword();
    } catch {
      /* ignore */
    }
  }
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(fallbackTokenPath());
  } catch {
    /* ignore */
  }
}
