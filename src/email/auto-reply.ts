function normalizeHeaderKey(key: string): string {
  return key.toLowerCase();
}

function normalizeHeaders(
  headers: Record<string, string | string[]>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const normalized = Array.isArray(value) ? value.join(", ") : value;
    out[normalizeHeaderKey(key)] = normalized;
  }
  return out;
}

/** Reject vacation responders and mailing-list noise. */
export function isAutoReplyEmail(
  headers: Record<string, string | string[]> | undefined,
): boolean {
  if (!headers) {
    return false;
  }

  const h = normalizeHeaders(headers);
  const autoSubmitted = h["auto-submitted"]?.toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") {
    return true;
  }

  if (h["x-auto-response-suppress"]) {
    return true;
  }

  const precedence = h["precedence"]?.toLowerCase();
  if (precedence === "bulk" || precedence === "junk" || precedence === "list") {
    return true;
  }

  return false;
}
