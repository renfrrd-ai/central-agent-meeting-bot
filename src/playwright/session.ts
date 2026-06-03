import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Env } from "../config/env.js";
import type { Platform } from "../parsers/types.js";

/** Absolute path to the saved `storageState` for a platform. */
export function sessionFilePath(env: Env, platform: Platform): string {
  return path.resolve(env.PLAYWRIGHT_SESSION_DIR, `${platform}.json`);
}

/** True when a signed-in session has been saved for the platform. */
export function hasSavedSession(env: Env, platform: Platform): boolean {
  return existsSync(sessionFilePath(env, platform));
}

/** Ensure the session directory exists; returns its absolute path. */
export async function ensureSessionDir(env: Env): Promise<string> {
  const dir = path.resolve(env.PLAYWRIGHT_SESSION_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}
