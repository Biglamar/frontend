/**
 * Build-time validation for this app's `NEXT_PUBLIC_*` variables (#26).
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle by Next.js at
 * build time, not read at runtime — so a misconfiguration can't be caught
 * or fixed after the fact the way a server-only env var could be. This
 * module's exports are pure and side-effect-free (they take a raw value in
 * and return a validated one out, or throw); `next.config.ts` is what
 * actually calls them at module-evaluation time so an invalid value aborts
 * `next build`/`next dev`/`next start` immediately, before anything else
 * runs. `config.ts` calls the same functions so every other consumer in
 * the app also gets the validated values, not a second, divergent check.
 */

export type StellarNetwork = "TESTNET" | "PUBLIC";

const VALID_STELLAR_NETWORKS: readonly StellarNetwork[] = ["TESTNET", "PUBLIC"];

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Validates `NEXT_PUBLIC_STELLAR_NETWORK`. Deliberately has no default —
 * unlike `NEXT_PUBLIC_API_URL` below, the wrong value here doesn't just
 * point at the wrong backend, it makes `wallet.ts#signTransaction` sign
 * with the wrong network passphrase (testnet passphrase in what's meant to
 * be a production build, or the reverse), which fails confusingly at the
 * Soroban contract layer at best. Network selection is too consequential
 * to guess a default for, so an unset or misspelled value fails the build
 * instead of silently picking one.
 *
 * The checked-in `.env.example` sets this explicitly, so the documented
 * `cp .env.example .env.local` quickstart never hits the "unset" branch.
 */
export function validateStellarNetwork(raw: string | undefined): StellarNetwork {
  if (raw === undefined || raw === "") {
    throw new EnvValidationError(
      'NEXT_PUBLIC_STELLAR_NETWORK is not set. It must be exactly "TESTNET" or "PUBLIC" — ' +
        "copy .env.example to .env.local for local dev, or set it explicitly in your " +
        "deployment's environment. There is no default: the wrong network signs " +
        "transactions with the wrong passphrase (see wallet.ts#signTransaction).",
    );
  }
  if (!VALID_STELLAR_NETWORKS.includes(raw as StellarNetwork)) {
    throw new EnvValidationError(
      `NEXT_PUBLIC_STELLAR_NETWORK is set to "${raw}", which is not a valid Stellar ` +
        'network. It must be exactly "TESTNET" or "PUBLIC" (case-sensitive) — e.g. ' +
        '"MAINNET" or "public" are common near-misses that are not accepted.',
    );
  }
  return raw as StellarNetwork;
}

const DEFAULT_API_BASE_URL = "http://localhost:4000/api";

/**
 * Validates `NEXT_PUBLIC_API_URL`'s shape. Unlike the network variable, a
 * localhost default is safe to keep here — nothing signs funds based on
 * this value, it only selects which backend to talk to, and the README's
 * documented local quickstart relies on this default being present.
 *
 * This checks the value is a well-formed URL (catches a truncated paste, a
 * missing protocol, stray whitespace, an empty string). It can't detect
 * "this is accidentally a production URL in a local .env.local" — that's a
 * question about deployment topology this repo doesn't document, not a
 * string-shape problem — so that class of mistake isn't covered here.
 */
export function validateApiUrl(raw: string | undefined): string {
  const value = raw === undefined || raw === "" ? DEFAULT_API_BASE_URL : raw;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new EnvValidationError(
      `NEXT_PUBLIC_API_URL is set to "${value}", which is not a valid URL. It must be a ` +
        'full URL including protocol, e.g. "http://localhost:4000/api" or ' +
        '"https://api.example.com".',
    );
  }

  // new URL() alone doesn't restrict the scheme — "javascript:alert(1)",
  // "file:///etc/passwd", and "ftp://example.com" all parse successfully
  // despite none being meaningful as an HTTP API base URL. A misconfigured
  // deployment with a stray non-http(s) scheme would otherwise pass this
  // check and only fail much later, at the actual fetch() call site, with
  // a far less clear error than this function exists to provide (#204).
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new EnvValidationError(
      `NEXT_PUBLIC_API_URL is set to "${value}", which uses the "${parsed.protocol}" ` +
        'scheme. It must use "http:" or "https:" — e.g. "http://localhost:4000/api" or ' +
        '"https://api.example.com".',
    );
  }

  return value;
}

export interface ValidatedEnv {
  stellarNetwork: StellarNetwork;
  apiBaseUrl: string;
}

/** Reads and validates every `NEXT_PUBLIC_*` variable this app depends on. */
export function loadValidatedEnv(): ValidatedEnv {
  return {
    stellarNetwork: validateStellarNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK),
    apiBaseUrl: validateApiUrl(process.env.NEXT_PUBLIC_API_URL),
  };
}
