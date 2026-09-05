import type { ApiErrorBody } from "@/types/api";

/**
 * Browser-side API client.
 *
 * Requests go to the Next.js proxy route, never directly to the backend, so no
 * backend URL or credential is ever present in the client bundle.
 */

const BASE = "/api/proxy";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "error") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Network request failed. Check your connection and try again.",
      0,
      "network_error",
    );
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    let code = "error";
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body?.error?.message) {
        message = body.error.message;
        code = body.error.code;
      }
    } catch {
      /* Response was not JSON; keep the generic message. */
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Builds a query string, omitting empty values. */
export function query(params: Record<string, string | number | boolean | undefined | null | string[]>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}
