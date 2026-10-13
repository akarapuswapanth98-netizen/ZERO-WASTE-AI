import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function forwardRequest(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const search = req.nextUrl.search;

  const backendBase = process.env.ZEROWASTE_API_BASE || "http://localhost:8000";
  const targetUrl = `${backendBase}/api/${path}${search}`;

  const apiKey = process.env.ZEROWASTE_API_KEY || "";
  const adminToken = process.env.ADMIN_TOKEN || "";

  // Prepare outgoing headers
  const headers = new Headers();
  headers.set("Content-Type", req.headers.get("Content-Type") || "application/json");
  headers.set("Accept", req.headers.get("Accept") || "application/json");

  // Server-side secret injection (Browser NEVER sees this)
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }

  // Pass admin token if present on server or client header
  const clientAdminToken = req.headers.get("X-Admin-Token");
  if (clientAdminToken) {
    headers.set("X-Admin-Token", clientAdminToken);
  } else if (adminToken) {
    headers.set("X-Admin-Token", adminToken);
  }

  try {
    let body: BodyInit | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    response.headers.forEach((val, key) => {
      // Forward content type and content disposition (for CSV export)
      if (["content-type", "content-disposition"].includes(key.toLowerCase())) {
        responseHeaders.set(key, val);
      }
    });

    const responseData = await response.arrayBuffer();

    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`Proxy error forwarding to ${targetUrl}:`, error.message);
    return NextResponse.json(
      {
        error: "Backend proxy error",
        message: "Failed to connect to ZeroWaste backend service.",
        target: `/api/${path}`,
      },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  return forwardRequest(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  return forwardRequest(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  return forwardRequest(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  return forwardRequest(req, ctx);
}
