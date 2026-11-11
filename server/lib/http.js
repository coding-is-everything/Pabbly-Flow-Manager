export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    // Messages from HttpError are written for the user, so app.js shows them even for 5xx.
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const forbidden = (msg = 'You do not have permission to do this') => new HttpError(403, msg);

export function toId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${label}`);
  return n;
}
