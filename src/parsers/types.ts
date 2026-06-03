export type Platform = "google_meet" | "teams" | "zoom";

export interface MeetingRef {
  platform: Platform;
  native_meeting_id: string;
  passcode?: string;
  sourceUrl?: string;
}

export interface JoinRequest {
  meetingUrl: string;
  botName?: string;
  force?: boolean;
  correlationId?: string;
}

export type JoinStatus =
  | "requested"
  | "running"
  | "joined"
  | "failed"
  | "duplicate"
  | "stopped";

export interface JoinResult {
  success: boolean;
  status: JoinStatus;
  meetingRef: MeetingRef;
  correlationId: string;
  vexaMeetingId?: string;
  message?: string;
}

export type BotLifecycleEvent =
  | "trigger_received"
  | "link_parsed"
  | "vexa_bot_requested"
  | "vexa_status"
  | "join_succeeded"
  | "join_failed";
