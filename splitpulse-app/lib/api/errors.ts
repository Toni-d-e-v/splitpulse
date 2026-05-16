export type ApiErrorCode =
  | "NO_AUTH"
  | "NO_ZONE"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "DUP_NAME"
  | "RATE_LIMIT"
  | "UPSTREAM_ERROR"
  | "INTERNAL";

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  NO_AUTH: 401,
  NO_ZONE: 422,
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  DUP_NAME: 409,
  RATE_LIMIT: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
};

export function errorResponse(
  message: string,
  code: ApiErrorCode,
  status?: number,
) {
  return Response.json(
    { error: message, code },
    { status: status ?? DEFAULT_STATUS[code] },
  );
}
