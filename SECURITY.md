# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MergeFi, please report it responsibly.
**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **security@mergefi.app** with:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fix (if you have one)

We will acknowledge your report within 48 hours and aim to provide a resolution
timeline within 7 business days.

## Scope

This security policy covers the MergeFi frontend (`mergefi/frontend`) and its
direct interaction with:

- Stellar/Soroban smart contracts via Freighter wallet
- GitHub OAuth authentication flow
- On-chain escrow, milestone funding, and payment release logic
- User wallet address handling and transaction signing

## Security Measures

### Build-Time Validation

All `NEXT_PUBLIC_*` environment variables are validated at build time
(`next.config.ts` / `src/lib/env.ts`). An unset or invalid value fails the
build immediately with a clear error, rather than silently falling back and
surfacing as an on-chain failure later.

### Security Headers

The following headers are set on every route and verified in CI via
`npm run verify:headers`:

| Header | Value | Purpose |
|---|---|---|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protects OAuth tokens in URLs |
| `Strict-Transport-Security` | `max-age=86400` | Enforces HTTPS |

### Wallet Security

- The frontend never stores private keys — all signing happens through the
  Freighter browser extension.
- Stellar network selection (`TESTNET` / `PUBLIC`) is required at build time
  and cannot be overridden at runtime, preventing accidental mainnet transactions.

### Authentication

- GitHub OAuth is handled entirely by the backend — the frontend holds no
  GitHub credentials.
- OAuth callback tokens are short-lived and never stored in `localStorage`.

## Responsible Disclosure

We kindly ask that you:

1. Allow us reasonable time to address the issue before public disclosure.
2. Do not exploit the vulnerability beyond what is necessary to demonstrate it.
3. Do not access or modify user data without explicit permission.

We recognize and appreciate security researchers who help keep MergeFi safe.
