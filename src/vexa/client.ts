import type { Env } from "../config/env.js";
import type { MeetingRef } from "../parsers/types.js";
import { parseVexaErrorBody } from "./errors.js";
import {
  VexaApiError,
  type VexaCreateBotRequest,
  type VexaMeetingRecord,
  type VexaRunningBot,
  type VexaRunningBotsResponse,
  type VexaStopBotResponse,
} from "./types.js";
import { validateMeetingRefForVexa } from "./validate.js";

export interface CreateBotOptions {
  botName?: string;
}

export interface VexaClientOptions {
  fetchImpl?: typeof fetch;
}

export class VexaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly recordingEnabled: boolean;
  private readonly transcribeEnabled: boolean;
  private readonly defaultBotName: string;

  constructor(env: Env, options: VexaClientOptions = {}) {
    this.baseUrl = env.VEXA_API_BASE.replace(/\/$/, "");
    this.apiKey = env.VEXA_API_KEY;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.recordingEnabled = env.RECORDING_ENABLED ?? false;
    this.transcribeEnabled = env.TRANSCRIBE_ENABLED ?? false;
    this.defaultBotName = env.BOT_DISPLAY_NAME;
  }

  private headers(includeJsonBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
    };
    if (includeJsonBody) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      throw parseVexaErrorBody(response.status, parsed);
    }

    return parsed as T;
  }

  /**
   * Build POST /bots body per https://docs.vexa.ai/api/bots
   */
  toCreateBotBody(
    meeting: MeetingRef,
    options?: CreateBotOptions,
  ): VexaCreateBotRequest {
    const payload: VexaCreateBotRequest = {
      platform: meeting.platform,
      native_meeting_id: meeting.native_meeting_id,
      bot_name: options?.botName ?? this.defaultBotName,
      recording_enabled: this.recordingEnabled,
      transcribe_enabled: this.transcribeEnabled,
    };

    if (this.transcribeEnabled) {
      payload.transcription_tier = "realtime";
    }

    if (meeting.passcode) {
      payload.passcode = meeting.passcode;
    }

    return payload;
  }

  async createBot(
    meeting: MeetingRef,
    options?: CreateBotOptions,
  ): Promise<VexaMeetingRecord> {
    validateMeetingRefForVexa(meeting);
    return this.request<VexaMeetingRecord>(
      "POST",
      "/bots",
      this.toCreateBotBody(meeting, options),
    );
  }

  async listRunningBots(): Promise<VexaRunningBot[]> {
    const data = await this.request<VexaRunningBotsResponse>(
      "GET",
      "/bots/status",
    );
    return data.running_bots ?? [];
  }

  async stopBot(meeting: MeetingRef): Promise<VexaStopBotResponse> {
    validateMeetingRefForVexa(meeting);
    return this.request<VexaStopBotResponse>(
      "DELETE",
      `/bots/${encodeURIComponent(meeting.platform)}/${encodeURIComponent(meeting.native_meeting_id)}`,
    );
  }

  findRunningBot(
    bots: VexaRunningBot[],
    meeting: MeetingRef,
  ): VexaRunningBot | undefined {
    return bots.find(
      (b) =>
        b.platform === meeting.platform &&
        b.native_meeting_id === meeting.native_meeting_id,
    );
  }
}

export { VexaApiError };
