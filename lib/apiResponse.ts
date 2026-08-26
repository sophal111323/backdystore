import { ValidationError } from "./validations";

// ── Success response ──────────────────────────────────────────────────────────
export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

// ── Error response — never leaks stack traces to client ───────────────────────
export function err(
  error: unknown,
  fallbackMessage = "Internal server error",
  fallbackStatus = 500
): Response {
  // Validation errors → 400
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  // Known Error objects — log server-side, send generic message to client
  if (error instanceof Error) {
    console.error("[API Error]", error.message, error.stack);
  } else {
    console.error("[API Error]", error);
  }

  // Never reveal internal details to the client
  return Response.json({ error: fallbackMessage }, { status: fallbackStatus });
}

// ── Unauthorized ──────────────────────────────────────────────────────────────
export function unauthorized(message = "Unauthorized"): Response {
  return Response.json({ error: message }, { status: 401 });
}

// ── Not found ─────────────────────────────────────────────────────────────────
export function notFound(message = "Not found"): Response {
  return Response.json({ error: message }, { status: 404 });
}