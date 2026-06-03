import type { MeetingRef } from "../parsers/index.js";
import type { JoinStatus } from "../parsers/types.js";

export interface FallbackResult {
  status: JoinStatus;
  screenshotPath?: string;
}

/**
 * Secondary join engine used when the primary Vexa path fails with a
 * retriable error. Implementations launch a real browser and join directly.
 */
export interface FallbackEngine {
  /** Whether this engine can handle the given meeting (e.g. google_meet only). */
  supports(meetingRef: MeetingRef): boolean;

  /** Attempt to join. Resolves with the resulting status; throws on failure. */
  join(meetingRef: MeetingRef, correlationId: string): Promise<FallbackResult>;

  /** Tear down any open browser sessions (called on graceful shutdown). */
  close(): Promise<void>;
}
