import { z } from "zod";

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}

const optionalNonEmptyString = z.preprocess(
  emptyStringToUndefined,
  z.string().optional(),
);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  VEXA_API_BASE: z.string().url().default("https://api.cloud.vexa.ai"),
  VEXA_API_KEY: z.string().min(1, "VEXA_API_KEY is required"),

  BOT_EMAIL: z.string().email().optional(),
  BOT_DISPLAY_NAME: z.string().default("Central Agent Bot"),

  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_WEBHOOK_SECRET: optionalNonEmptyString,

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

  /** Max email-triggered joins per sender per hour; 0 = unlimited. */
  EMAIL_JOIN_RATE_LIMIT_PER_HOUR: z.coerce.number().int().nonnegative().default(10),
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
