const PROFANITY = [
  "asshole",
  "bastard",
  "bitch",
  "cunt",
  "dick",
  "fuck",
  "nigga",
  "nigger",
  "shit",
  "slut",
  "whore"
] as const;

export type NicknameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "empty" | "too_long" | "profanity" };

export function containsProfanity(value: string): boolean {
  const normalized = value.normalize("NFKC").toLocaleLowerCase();
  return PROFANITY.some((word) => new RegExp(`\\b${word}\\b`, "u").test(normalized));
}

export function validateNickname(raw: string): NicknameValidation {
  const value = raw.trim();
  const length = Array.from(value).length;

  if (length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (length > 32) {
    return { ok: false, reason: "too_long" };
  }

  if (containsProfanity(value)) {
    return { ok: false, reason: "profanity" };
  }

  return { ok: true, value };
}
