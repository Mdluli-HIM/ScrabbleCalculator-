export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDisplayName(
  displayName: string
): string {
  return displayName
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePlayerName(
  displayName: string
): string {
  return normalizeDisplayName(displayName).toLowerCase();
}
