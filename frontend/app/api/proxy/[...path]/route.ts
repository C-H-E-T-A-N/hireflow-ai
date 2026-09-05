import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy to the FastAPI backend.
 *
 * The browser only ever talks to this Next.js route, which means the backend
 * URL - and every credential the backend holds - stays out of the client
 * bundle. It also removes the need for CORS in the common deployment shape.
 */

const BACKEND_URL = (process.env.BACKEND_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const API_PREFIX = "/api/v1";

/**
 * Upstream timeout. Generous on purpose: free hosting tiers spin the backend
 * down when idle, and the first request after that pays a cold start of up to
 * ~50s. Without an explicit bound the function would hang until the platform
 * killed it, producing an opaque failure instead of a usable error state.
 */
const UPSTREAM_TIMEOUT_MS = 50_000;

// Allow the route to outlive a cold start rather than being cut off mid-wait.
export const maxDuration = 60;

// Hop-by-hop and identity headers that must not be forwarded verbatim.
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "cookie",
]);

async function forward(request: NextRequest, path: string[]) {
  const search = request.nextUrl.search;
  const target = `${BACKEND_URL}${API_PREFIX}/${path.join("/")}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const method = request.method;
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.text();

  try {
    const response = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    // The backend is unreachable or too slow. Return the same error envelope the
    // API itself uses, so every screen's error state renders it without any
    // special-casing - and distinguish a cold start from a hard failure, since
    // the fix for one is "wait" and for the other is "check configuration".
    const timedOut = error instanceof Error && error.name === "TimeoutError";

    return NextResponse.json(
      {
        error: {
          code: timedOut ? "backend_timeout" : "backend_unreachable",
          message: timedOut
            ? "The HireFlow API did not respond in time. Free hosting tiers sleep when idle, so the first request after a pause can take up to a minute - please retry."
            : "Could not reach the HireFlow API. Check that the backend is running and BACKEND_API_URL is correct.",
          details: [],
        },
      },
      { status: timedOut ? 504 : 503 },
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path);
}
