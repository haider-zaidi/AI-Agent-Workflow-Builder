export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = "Not authenticated") {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Not authorized") {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, message);
  }
}
