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
    });

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    // The backend is unreachable. Return the same error envelope the API uses
    // so every screen's error state can render it without special-casing.
    return NextResponse.json(
      {
        error: {
          code: "backend_unreachable",
          message:
            "Could not reach the HireFlow API. Check that the backend is running and BACKEND_API_URL is correct.",
          details: [],
        },
      },
      { status: 503 },
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
