import { VexaApiError } from "./types.js";

/** Parse Vexa/FastAPI error envelope: `{ "detail": "..." }` or validation array. */
export function parseVexaErrorBody(
  status: number,
  parsed: unknown,
): VexaApiError {
  const code =
    status >= 500 ? "vexa_5xx" : status >= 400 ? "vexa_4xx" : "vexa_error";

  if (typeof parsed === "object" && parsed !== null && "detail" in parsed) {
    const { detail } = parsed as { detail: unknown };
    if (typeof detail === "string") {
      return new VexaApiError(status, code, detail, parsed);
    }
    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return JSON.stringify(item);
        })
        .join("; ");
      return new VexaApiError(status, code, message || `Vexa API error (${status})`, parsed);
    }
  }

  return new VexaApiError(status, code, `Vexa API error (${status})`, parsed);
}
