export class MissingIdempotencyKeyError extends Error {
  constructor() {
    super("Payout endpoints require an Idempotency-Key header of at least 8 characters.");
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
  if (headerValue === undefined || headerValue.trim().length < 8) {
    throw new MissingIdempotencyKeyError();
  }
  return headerValue.trim();
}
