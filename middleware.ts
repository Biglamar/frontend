import { NextResponse, type NextRequest } from "next/server";

/**
 * Nonce-based CSP middleware (#610).
 *
 * Generates a per-request cryptographic nonce and sets it in the
 * Content-Security-Policy header. The nonce is also exposed via the
 * `x-nonce` request header so layout.tsx can pass it to React's
 * `nonce` prop on the root <html> element (React 19 threads it through
 * to all hydration inline scripts).
 *
 * With `'strict-dynamic'`, scripts loaded by an already-trusted script
 * are also trusted, so Next.js's own runtime script can load its chunks
 * without a separate origin allowlist entry.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());

  const apiOrigin = process.env.NEXT_PUBLIC_API_URL
    ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
    : "http://localhost:4000";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://avatars.githubusercontent.com https://api.dicebear.com data:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public assets
     */
    {
      source: "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
