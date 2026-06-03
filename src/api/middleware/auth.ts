import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../../config/env.js";

export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  env: Env,
): Promise<void> {
  const headerKey = request.headers["x-api-key"];
  const authHeader = request.headers.authorization;

  let provided: string | undefined;
  if (typeof headerKey === "string" && headerKey.length > 0) {
    provided = headerKey;
  } else if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    provided = authHeader.slice("Bearer ".length).trim();
  }

  if (!provided || provided !== env.API_KEY) {
    await reply.code(401).send({
      success: false,
      error: { code: "unauthorized", message: "Invalid or missing API key" },
    });
  }
}
