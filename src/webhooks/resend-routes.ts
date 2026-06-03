import type { FastifyInstance } from "fastify";
import { Resend } from "resend";
import type { Env } from "../config/env.js";
import { isResendWebhookEnabled } from "../config/resend.js";
import type { Logger } from "../logging/logger.js";
import type { JoinOrchestrator } from "../orchestrator/join.js";
import {
  EmailInviteProcessor,
  type EmailReceivedEvent,
} from "../email/invite-processor.js";
import { ResendReceivingService } from "../email/resend-client.js";

export interface RegisterResendWebhookOptions {
  env: Env;
  logger: Logger;
  orchestrator: JoinOrchestrator;
  processor?: EmailInviteProcessor;
  verifyWebhook?: (
    payload: string,
    headers: Record<string, string | undefined>,
  ) => EmailReceivedEvent | { type: string };
}

function getSvixHeaders(
  request: { headers: Record<string, string | string[] | undefined> },
): Record<string, string | undefined> {
  const h = request.headers;
  const pick = (name: string) => {
    const value = h[name.toLowerCase()] ?? h[name];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  return {
    "svix-id": pick("svix-id"),
    "svix-timestamp": pick("svix-timestamp"),
    "svix-signature": pick("svix-signature"),
  };
}

export async function registerResendWebhookRoutes(
  app: FastifyInstance,
  options: RegisterResendWebhookOptions,
): Promise<void> {
  const { env, logger, orchestrator } = options;
  const enabled = isResendWebhookEnabled(env);

  const processor = enabled
    ? (options.processor ??
      new EmailInviteProcessor({
        env,
        logger,
        orchestrator,
        resendClient: new ResendReceivingService(env.RESEND_API_KEY!),
      }))
    : undefined;

  const resend = enabled ? new Resend(env.RESEND_API_KEY!) : null;

  const verifyWebhook =
    options.verifyWebhook ??
    (enabled && resend
      ? (payload, headers) =>
          resend.webhooks.verify({
            payload,
            headers: {
              id: headers["svix-id"] ?? "",
              timestamp: headers["svix-timestamp"] ?? "",
              signature: headers["svix-signature"] ?? "",
            },
            webhookSecret: env.RESEND_WEBHOOK_SECRET!,
          }) as EmailReceivedEvent | { type: string }
      : undefined);

  await app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_request, body, done) => {
        done(null, body);
      },
    );

    webhookApp.post("/webhooks/resend", async (request, reply) => {
      if (!enabled || !processor || !verifyWebhook) {
        return reply.code(503).send({
          success: false,
          error: "webhook_not_configured",
          message:
            "Set RESEND_API_KEY and RESEND_WEBHOOK_SECRET in .env, then restart the server.",
        });
      }

      const payload = request.body as string;

      let event: EmailReceivedEvent | { type: string };
      try {
        event = verifyWebhook(payload, getSvixHeaders(request));
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : "verify_failed",
          },
          "resend_webhook_invalid_signature",
        );
        return reply.code(400).send({ success: false, error: "invalid_signature" });
      }

      if (event.type !== "email.received") {
        return reply.send({ success: true, ignored: true });
      }

      void processor.processEvent(event as EmailReceivedEvent).catch((error) => {
        logger.error(
          {
            error: error instanceof Error ? error.message : "process_failed",
            emailId: (event as EmailReceivedEvent).data.email_id,
          },
          "email_invite_process_failed",
        );
      });

      return reply.send({ success: true, received: true });
    });
  });

  if (enabled) {
    logger.info("Resend webhook enabled at POST /webhooks/resend");
  } else {
    logger.warn(
      "Resend webhook route registered but disabled — set RESEND_API_KEY and RESEND_WEBHOOK_SECRET, then restart",
    );
  }
}
