export class MissingIdempotencyKeyError extends Error {
  constructor() {
    super("Payout endpoints require an Idempotency-Key header of at least 8 characters.");
    this.name = "MissingIdempotencyKeyError";
  }
}

export function readIdempotencyKey(headerValue: string | undefined): string {
  if (headerValue === undefined || headerValue.trim().length < 8) {
    throw new MissingIdempotencyKeyError();
  }
  return headerValue.trim();
}
