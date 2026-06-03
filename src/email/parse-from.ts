/** Parse `Name <user@domain.com>` or bare address. */
export function parseEmailAddress(from: string): string {
  const trimmed = from.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const address = angleMatch ? angleMatch[1]! : trimmed;
  return address.trim().toLowerCase();
}
