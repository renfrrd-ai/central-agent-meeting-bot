import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import type { Env } from "../config/env.js";
import { logLifecycle, type Logger } from "../logging/logger.js";
import type { MeetingRef } from "../parsers/index.js";
import { hasSavedSession, sessionFilePath } from "./session.js";

const SCREENSHOT_DIR = "logs/screenshots";
const PAGE_TIMEOUT_MS = 30_000;
const IN_CALL_TIMEOUT_MS = 60_000;

export class FallbackJoinError extends Error {
  readonly screenshotPath?: string;

  constructor(message: string, screenshotPath?: string) {
    super(message);
    this.name = "FallbackJoinError";
    this.screenshotPath = screenshotPath;
  }
}

export interface MeetJoinContext {
  meetingRef: MeetingRef;
  env: Env;
  logger: Logger;
  correlationId: string;
}

export interface MeetJoinOutcome {
  /** True when the bot is in the call; false when waiting in the lobby. */
  joined: boolean;
  /** Caller owns the browser lifecycle on success (must close on shutdown). */
  browser: Browser;
  screenshotPath?: string;
}

function meetUrl(meetingRef: MeetingRef): string {
  return meetingRef.sourceUrl ?? `https://meet.google.com/${meetingRef.native_meeting_id}`;
}

/** Best-effort: click an element matching any selector, ignore if absent. */
async function clickFirst(page: Page, selectors: string[], timeout = 4_000): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.click({ timeout });
      return true;
    } catch {
      // try next selector
    }
  }
  return false;
}

async function captureScreenshot(page: Page, correlationId: string): Promise<string | undefined> {
  try {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    const file = path.join(SCREENSHOT_DIR, `meet-${correlationId}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return undefined;
  }
}

/**
 * Join a Google Meet via a real Chromium browser.
 *
 * Uses a saved signed-in session when available (see `npm run auth:google`),
 * otherwise joins as a guest using the configured display name. On success the
 * browser is left open and returned; on failure a screenshot is captured and a
 * {@link FallbackJoinError} is thrown.
 *
 * @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
 */
export async function joinGoogleMeet(ctx: MeetJoinContext): Promise<MeetJoinOutcome> {
  const { meetingRef, env, logger, correlationId } = ctx;
  const url = meetUrl(meetingRef);
  const signedIn = hasSavedSession(env, "google_meet");

  const browser = await chromium.launch({
    headless: env.HEADLESS,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  let page: Page | undefined;
  try {
    const context = await browser.newContext({
      storageState: signedIn ? sessionFilePath(env, "google_meet") : undefined,
      permissions: [],
    });
    page = await context.newPage();

    await page.goto(url, { waitUntil: "load", timeout: PAGE_TIMEOUT_MS });

    // Guest flow: enter a display name if prompted.
    if (!signedIn) {
      try {
        const nameInput = page
          .locator('input[type="text"][aria-label*="name" i], input[placeholder*="name" i]')
          .first();
        await nameInput.fill(env.BOT_DISPLAY_NAME, { timeout: 6_000 });
      } catch {
        // Name prompt may not appear (e.g. already signed in via session).
      }
    }

    // Best-effort: mute mic and camera before joining.
    await clickFirst(page, [
      'div[role="button"][aria-label*="Turn off microphone" i]',
      'button[aria-label*="Turn off microphone" i]',
    ]);
    await clickFirst(page, [
      'div[role="button"][aria-label*="Turn off camera" i]',
      'button[aria-label*="Turn off camera" i]',
    ]);

    const clickedJoin = await clickFirst(
      page,
      [
        'button:has-text("Ask to join")',
        'button:has-text("Join now")',
        'span:has-text("Ask to join")',
        'span:has-text("Join now")',
      ],
      8_000,
    );

    if (!clickedJoin) {
      const screenshotPath = await captureScreenshot(page, correlationId);
      throw new FallbackJoinError("Could not find a join button on the Meet page", screenshotPath);
    }

    // Joined when the in-call "Leave call" control appears within the lobby timeout.
    try {
      await page
        .locator('button[aria-label*="Leave call" i], [aria-label*="Leave call" i]')
        .first()
        .waitFor({ state: "visible", timeout: IN_CALL_TIMEOUT_MS });
      logLifecycle(logger, "fallback_succeeded", {
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
        admitted: true,
      });
      return { joined: true, browser };
    } catch {
      // Clicked join but not yet admitted — bot waits in the lobby.
      return { joined: false, browser };
    }
  } catch (error) {
    const screenshotPath =
      error instanceof FallbackJoinError
        ? error.screenshotPath
        : page
          ? await captureScreenshot(page, correlationId)
          : undefined;
    await browser.close();
    if (error instanceof FallbackJoinError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown Meet join error";
    throw new FallbackJoinError(`Playwright Meet join failed: ${message}`, screenshotPath);
  }
}
