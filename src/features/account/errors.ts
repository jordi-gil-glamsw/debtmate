/** Thrown when the user closes the Apple/Google sheet: callers should just ignore it. */
export class AuthCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}
