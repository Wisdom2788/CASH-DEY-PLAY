export class MissingIdempotencyKeyError extends Error {
  constructor() {
    super("Idempotency-Key must contain 8 to 128 letters, digits, dots, underscores, colons or hyphens.");
    this.name = "MissingIdempotencyKeyError";
  }
}

/** The route exists but the feature behind it is not built yet. Never answer with a fake success. */
export class NotImplementedFeatureError extends Error {
  constructor(featureDescription: string) {
    super(`${featureDescription} is not available yet.`);
    this.name = "NotImplementedFeatureError";
  }
}

export function readIdempotencyKey(headerValue: string | undefined): string {
  if (headerValue === undefined || !/^[A-Za-z0-9._:-]{8,128}$/.test(headerValue.trim())) {
    throw new MissingIdempotencyKeyError();
  }
  return headerValue.trim();
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "ServiceUnavailableError"; }
}
