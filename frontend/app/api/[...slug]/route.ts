import { NextResponse, type NextRequest } from "next/server";

// Locked-down proxy: only the routes + methods the UI uses are forwarded.
// Anything else -> 404 (unknown) or 403 (known path, wrong method).
// /api/seed/reset is destructive: in production it additionally requires
// X-Admin-Token matching server-only ADMIN_TOKEN (403 otherwise). In dev it
// stays open so Seed demo / E2E keep working.
// NOTE: ZEROWASTE_API_BASE / ZEROWASTE_API_KEY / ADMIN_TOKEN are read per-request
// inside proxy()/seedAllowed() (server-only, never NEXT_PUBLIC_).

// [path pattern, allowed methods]; trailing /* = prefix match (IDs)
const ALLOW: Array<[string, Array<string>]> = [
  ["/api/health", ["GET"]],
  ["/api/stores", ["GET"]],
  ["/api/products", ["GET"]],
  ["/api/inventory", ["GET"]],
  ["/api/forecast", ["GET"]],
  ["/api/risk", ["GET"]],
  ["/api/agents/run", ["POST"]],
  ["/api/agents/replay", ["POST"]],
  ["/api/agents/runs/*", ["GET"]],
  ["/api/recommendations", ["GET"]],
  ["/api/recommendations/*", ["GET"]],
  ["/api/planner/approve/*", ["POST"]],
  ["/api/planner/reject/*", ["POST"]],
  ["/api/planner/bulk-approve", ["POST"]],
  ["/api/execute/*", ["POST"]],
  ["/api/scenarios/run", ["POST"]],
  ["/api/scenarios/calibration", ["GET"]],
  ["/api/evaluation", ["GET"]],
  ["/api/audit", ["GET"]],
  ["/api/export/csv", ["GET"]],
  ["/api/seed/reset", ["POST"]],
];

function match(path: string): Array<string> | null {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  for (const [pattern, methods] of ALLOW) {
    if (pattern.endsWith("/*")) {
      const base = pattern.slice(0, -2);
      if (clean === base || clean.startsWith(`${base}/`)) return methods;
    } else if (clean === pattern) {
      return methods;
    }
  }
  return null;
}

function seedAllowed(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const adminToken = process.env.ADMIN_TOKEN ?? "";
  if (!adminToken) return false;
  return req.headers.get("x-admin-token") === adminToken;
}

async function proxy(req: NextRequest, method: string) {
  // Read env at request time (not module top) so Vercel env edits take effect
  // without a code change; strip any trailing slash to avoid `//api/...`.
  const backend = (process.env.ZEROWASTE_API_BASE ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const key = process.env.ZEROWASTE_API_KEY ?? "";
  const slug = req.nextUrl.pathname.replace(/^\/api\//, "");
  const path = `/api/${slug}`;
  const methods = match(path);
  if (!methods) {
    return NextResponse.json({ detail: `no proxied route for ${path}` }, { status: 404 });
  }
  if (!methods.includes(method)) {
    return NextResponse.json({ detail: `method ${method} not allowed for ${path}` }, { status: 403 });
  }
  if (path === "/api/seed/reset" && !seedAllowed(req)) {
    return NextResponse.json(
      { detail: "seed/reset is disabled in production without a valid X-Admin-Token" },
      { status: 403 },
    );
  }
  const url = `${backend}${path}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  if (key) headers["X-API-Key"] = key;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer(),
      cache: "no-store",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `backend unreachable at ${backend}: ${msg}` }, { status: 502 });
  }
  const buf = await res.arrayBuffer();
  const out = new Headers();
  const rct = res.headers.get("content-type");
  if (rct) out.set("content-type", rct);
  const disp = res.headers.get("content-disposition");
  if (disp) out.set("content-disposition", disp);
  return new NextResponse(buf, { status: res.status, headers: out });
}

export function GET(req: NextRequest) {
  return proxy(req, "GET");
}
export function POST(req: NextRequest) {
  return proxy(req, "POST");
}
export function PUT(req: NextRequest) {
  return proxy(req, "PUT");
}
export function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}
export function DELETE(req: NextRequest) {
  return proxy(req, "DELETE");
}
