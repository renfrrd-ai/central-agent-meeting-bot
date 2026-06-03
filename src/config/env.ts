import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  API_KEY: z.string().min(1, "API_KEY is required"),

  VEXA_API_BASE: z.string().url().default("https://api.cloud.vexa.ai"),
  VEXA_API_KEY: z.string().min(1, "VEXA_API_KEY is required"),

  BOT_EMAIL: z.string().email().optional(),
  BOT_DISPLAY_NAME: z.string().default("Central Agent Bot"),

  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  INVITE_SENDER_MODE: z.enum(["strict", "domain", "open"]).default("open"),
  ALLOWED_INVITE_SENDERS: z.string().default(""),
  ALLOWED_INVITE_DOMAINS: z.string().default(""),

  RECORDING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  TRANSCRIBE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  FALLBACK_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  HEADLESS: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  PLAYWRIGHT_SESSION_DIR: z.string().default("./data/sessions"),

  VEXA_JOIN_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  VEXA_JOIN_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(overrides?: Record<string, string | undefined>): Env {
  if (cached && !overrides) {
    return cached;
  }

  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }

  if (!overrides) {
    cached = parsed.data;
  }
  return parsed.data;
}

export function resetEnvCache(): void {
  cached = undefined;
}

export function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
