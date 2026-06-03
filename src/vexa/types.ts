import type { Platform } from "../parsers/types.js";

/** POST /bots request body — https://docs.vexa.ai/api/bots */
export interface VexaCreateBotRequest {
  platform: Platform;
  native_meeting_id: string;
  passcode?: string;
  language?: string;
  task?: "transcribe" | "translate";
  bot_name?: string;
  recording_enabled?: boolean;
  transcribe_enabled?: boolean;
  transcription_tier?: "realtime" | "deferred";
  voice_agent_enabled?: boolean;
}

/** POST /bots 201 response meeting record */
export interface VexaMeetingRecord {
  id?: number;
  user_id?: number;
  platform: Platform;
  native_meeting_id: string;
  constructed_meeting_url?: string;
  status?: string;
  bot_container_id?: string;
  start_time?: string | null;
  end_time?: string | null;
  data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

/** GET /bots/status running bot entry */
export interface VexaRunningBot {
  container_id?: string;
  container_name?: string;
  platform: Platform;
  native_meeting_id: string;
  status?: string;
  normalized_status?: string;
  created_at?: string;
  labels?: Record<string, string>;
  meeting_id_from_name?: string;
}

export interface VexaRunningBotsResponse {
  running_bots: VexaRunningBot[];
}

/** DELETE /bots 202 response */
export interface VexaStopBotResponse {
  message?: string;
}

export class VexaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body?: unknown;

  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message);
    this.name = "VexaApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}
