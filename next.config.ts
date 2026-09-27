import type { NextConfig } from "next";
import { loadValidatedEnv } from "./src/lib/env";

/**
 * Validated at module-evaluation time — i.e. as soon as `next build`,
 * `next dev`, or `next start` loads this file, before anything else runs
 * (verified empirically: a throw here surfaces as "Build error occurred"
 * and a non-zero exit code, not a runtime failure) — so a missing or
 * invalid NEXT_PUBLIC_STELLAR_NETWORK/NEXT_PUBLIC_API_URL fails loudly at
 * build time instead of silently shipping a build signed against the
 * wrong Stellar network (#26). A relative import is used rather than the
 * `@/*` path alias other files in this app use: next.config.ts is loaded
 * outside the normal webpack/Turbopack module graph, so it isn't
 * guaranteed to resolve tsconfig path aliases the same way application
 * code does.
 */
const env = loadValidatedEnv();
const apiOrigin = new URL(env.apiBaseUrl).origin;

/**
 * Production security headers (#50), applied to every route below.
 *
 * - X-Frame-Options: DENY — MergeFi has no legitimate iframe-embedding use
 *   case (checked: no `iframe`/embed usage anywhere in this app), and
 *   real-money actions (fund/claim) are one click away in this UI, making
 *   clickjacking a genuine risk. If a legitimate embed need shows up later
 *   (e.g. a GitHub App/marketplace surface), relax this to a scoped
 *   `frame-ancestors` allowlist via CSP instead of removing it outright.
 * - X-Content-Type-Options: nosniff — stops the browser from MIME-sniffing
 *   a response into an executable content type.
 * - Referrer-Policy: strict-origin-when-cross-origin — the GitHub OAuth
 *   callback at /auth/callback carries a short-lived token in its query
 *   string (see CallbackClient.tsx); this keeps the full URL out of the
 *   Referer header sent with any cross-origin request, while still
 *   sending it for same-origin requests, which is the least surprising
 *   choice absent a reason to be stricter.
 * - Strict-Transport-Security: deliberately conservative to start — a
 *   short max-age, no `includeSubDomains`, no `preload`. HSTS is
 *   effectively irreversible once a browser has cached it (and
 *   preload-list removal is slow), so this is a "start small" rollout:
 *   once this has run in production for a while with no HTTPS/cert
 *   issues, raise max-age and add `includeSubDomains`, and only add
 *   `preload` (and submit to hstspreload.org) once *that* has been stable
 *   too. The browser ignores this header entirely over plain HTTP, so
 *   it's harmless to always send.
 *
 * Content-Security-Policy (#4):
 * - 'unsafe-inline' is required for: (1) the theme-init inline script in
 *   <head>, (2) Turbopack dev-mode HMR inline scripts, and (3) React 19's
 *   hydration inline scripts. A nonce or hash-based approach would be more
 *   secure but requires build-time instrumentation that composes poorly
 *   with Turbopack's current dev mode. 'unsafe-inline' for scripts is
 *   still a meaningful upgrade over no CSP at all — it blocks external
 *   script injection from third-party origins and inline event handlers
 *   (onclick, onerror) injected via XSS.
 * - connect-src includes the API backend so authenticated fetches work.
 * - img-src allows GitHub avatars and DiceBear identicons.
 * - Freighter wallet extension content scripts are not blocked by CSP
 *   (browser extensions inject with extension privileges).
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=86400" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https://avatars.githubusercontent.com https://api.dicebear.com data:",
      "font-src 'self'",
      `connect-src 'self' ${apiOrigin}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    contentDispositionType: "attachment",
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
