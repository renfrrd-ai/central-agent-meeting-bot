import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import type { Logger } from "../logging/logger.js";
import { JoinOrchestrator } from "../orchestrator/join.js";
import { ParseError, parseMeetingUrl } from "../parsers/index.js";
import type { MeetingRef, Platform } from "../parsers/types.js";
import { VexaApiError } from "../vexa/types.js";
import { validateMeetingRefForVexa } from "../vexa/validate.js";
import {
  joinBodySchema,
  leaveBodySchema,
  platformParamSchema,
} from "./schemas.js";

export interface RegisterRoutesOptions {
  env: Env;
  logger: Logger;
  orchestrator?: JoinOrchestrator;
}

function errorResponse(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

function leaveBodyToMeetingRef(body: {
  meetingUrl?: string;
  platform?: Platform;
  nativeMeetingId?: string;
  passcode?: string;
}): MeetingRef {
  if (body.meetingUrl) {
    return parseMeetingUrl(body.meetingUrl);
  }
  return {
    platform: body.platform!,
    native_meeting_id: body.nativeMeetingId!,
    passcode: body.passcode,
  };
}

export async function registerApiRoutes(
  app: FastifyInstance,
  options: RegisterRoutesOptions,
): Promise<void> {
  const orchestrator =
    options.orchestrator ?? new JoinOrchestrator(options);

  app.post("/api/join", async (request, reply) => {
    const parsed = joinBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send(
          errorResponse(
            "validation_error",
            parsed.error.issues.map((i) => i.message).join("; "),
          ),
        );
    }

    const correlationId =
      typeof request.headers["x-correlation-id"] === "string"
        ? request.headers["x-correlation-id"]
        : undefined;

    try {
      const meetingRef = parseMeetingUrl(parsed.data.meetingUrl);
      validateMeetingRefForVexa(meetingRef);
      const result = await orchestrator.join({
        meetingRef,
        botName: parsed.data.botName,
        force: parsed.data.force,
        correlationId,
      });

      return reply.send({
        success: true,
        data: {
          meetingRef: result.meetingRef,
          status: result.status,
          correlationId: result.correlationId,
          vexaMeetingId: result.vexaMeetingId,
          message: result.message,
        },
      });
    } catch (error) {
      if (error instanceof ParseError) {
        return reply.code(400).send(errorResponse(error.code, error.message));
      }
      if (error instanceof VexaApiError) {
        return reply
          .code(error.status)
          .send(errorResponse(error.code, error.message));
      }
      options.logger.error({ error }, "join_failed");
      return reply
        .code(500)
        .send(errorResponse("internal_error", "Failed to join meeting"));
    }
  });

  app.get("/api/status/:platform/:nativeMeetingId", async (request, reply) => {
    const platformResult = platformParamSchema.safeParse(
      (request.params as { platform: string }).platform,
    );
    const nativeMeetingId = (request.params as { nativeMeetingId: string })
      .nativeMeetingId;

    if (!platformResult.success || !nativeMeetingId) {
      return reply
        .code(400)
        .send(errorResponse("validation_error", "Invalid platform or meeting id"));
    }

    const passcode =
      typeof request.query === "object" &&
      request.query !== null &&
      "passcode" in request.query &&
      typeof (request.query as { passcode?: string }).passcode === "string"
        ? (request.query as { passcode: string }).passcode
        : undefined;

    const meetingRef: MeetingRef = {
      platform: platformResult.data,
      native_meeting_id: nativeMeetingId,
      passcode,
    };

    try {
      const status = await orchestrator.getStatus(meetingRef);
      return reply.send({ success: true, data: { meetingRef, status } });
    } catch (error) {
      if (error instanceof VexaApiError) {
        return reply
          .code(error.status)
          .send(errorResponse(error.code, error.message));
      }
      return reply
        .code(500)
        .send(errorResponse("internal_error", "Failed to get status"));
    }
  });

  app.post("/api/leave", async (request, reply) => {
    const parsed = leaveBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send(
          errorResponse(
            "validation_error",
            parsed.error.issues.map((i) => i.message).join("; "),
          ),
        );
    }

    try {
      const meetingRef = leaveBodyToMeetingRef(parsed.data);
      validateMeetingRefForVexa(meetingRef);
      await orchestrator.leave(meetingRef);
      return reply.send({
        success: true,
        data: { meetingRef, status: "stopped" },
      });
    } catch (error) {
      if (error instanceof ParseError) {
        return reply.code(400).send(errorResponse(error.code, error.message));
      }
      if (error instanceof VexaApiError) {
        return reply
          .code(error.status)
          .send(errorResponse(error.code, error.message));
      }
      return reply
        .code(500)
        .send(errorResponse("internal_error", "Failed to leave meeting"));
    }
  });
}
