import "dotenv/config";
import { chromium } from "playwright";
import { loadEnv } from "../config/env.js";
import { ensureSessionDir, sessionFilePath } from "./session.js";

const LOGIN_TIMEOUT_MS = 5 * 60_000;

/**
 * One-time interactive login that saves a Google `storageState` so the fallback
 * engine can join meetings as a signed-in user (avoids guest-join limits).
 *
 * Run: `npm run auth:google`
 */
async function main(): Promise<void> {
  const env = loadEnv();
  await ensureSessionDir(env);
  const out = sessionFilePath(env, "google_meet");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://accounts.google.com/");
  console.log("A browser window opened. Sign in to the Google account the bot should use.");
  console.log("Waiting for sign-in to complete (up to 5 minutes)...");

  await page.waitForURL(/myaccount\.google\.com/, { timeout: LOGIN_TIMEOUT_MS });
  await context.storageState({ path: out });
  console.log(`Saved signed-in session to ${out}`);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
