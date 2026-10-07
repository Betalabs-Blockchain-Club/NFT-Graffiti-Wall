export class StorageError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "StorageError";
  }
}

export function requiredString(value: unknown, name: string, maxLength = 256): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new StorageError("invalid-input", `${name} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value;
}
