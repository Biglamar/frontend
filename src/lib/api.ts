import { API_BASE_URL } from "./config";
import { getToken } from "./auth";
import {
  adaptBounty,
  adaptMilestone,
  adaptMaintenancePool,
  adaptReputation,
  type RawBounty,
  type RawMilestone,
  type RawMaintenancePool,
  type RawReputationSnapshot,
  type RawUserProfile,
} from "./adapters";
import type { Bounty, Milestone, MaintenancePool, ReputationProfile } from "@/types";

export class ApiUnavailableError extends Error {}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

/**
 * Distinguishes live backend data from mock fallback so callers can surface
 * a visible indicator without relying on fragile reference-identity checks.
 */
export interface FetchResult<T> {
  data: T;
  source: "live" | "mock";
}

function logFetchError(path: string, kind: "network" | "http" | "parse", detail: string) {
  console.error(`[api] ${kind} error on ${path}: ${detail}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: init?.signal ?? timeout,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      logFetchError(path, "network", "Request timed out");
      throw new ApiUnavailableError(`Request to ${path} timed out`);
    }
    logFetchError(path, "network", err instanceof Error ? err.message : String(err));
    throw new ApiUnavailableError(`Network error on ${path}`);
  }
  if (!res.ok) {
    logFetchError(path, "http", `${res.status} ${res.statusText}`);
    throw new ApiUnavailableError(`Request to ${path} failed: ${res.status}`);
  }
  try {
    return (await res.json()) as T;
  } catch (err) {
    logFetchError(path, "parse", err instanceof Error ? err.message : String(err));
    throw new ApiUnavailableError(`Invalid JSON from ${path}`);
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// In-flight request deduplication (#44)
// ---------------------------------------------------------------------------
// Maps a request signature (method + path + body hash) to the in-flight
// Promise so rapid double-clicks on the same mutation coalesce into one
// network request instead of two.

const inflight = new Map<string, Promise<unknown>>();

function requestKey(method: string, path: string, body?: string): string {
  return `${method}:${path}:${body ?? ""}`;
}

async function dedupedFetch<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * Client-side call that attaches the signed-in user's JWT (if any) and
 * surfaces backend error bodies instead of silently falling back — used for
 * actions the user explicitly triggers (claim, fund, deposit, ...), where
 * hiding a failure behind mock data would be misleading.
 */
export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const bodyStr = init?.body != null ? String(init.body) : undefined;
  const key = requestKey(init?.method ?? "GET", path, bodyStr);

  return dedupedFetch(key, async () => {
    const token = getToken();
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
        signal: init?.signal ?? timeout,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new ApiRequestError("Request timed out — please try again.", 0);
      }
      throw err;
    }

    // --- Rate-limit handling (#44) ---
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const seconds = retryAfter ? parseInt(retryAfter, 10) : NaN;
      const waitMsg = Number.isFinite(seconds)
        ? ` Please wait ${seconds} second${seconds === 1 ? "" : "s"} before trying again.`
        : "";
      throw new ApiRequestError(
        `You're doing that too fast.${waitMsg}` || `Rate limited. Please try again later.`,
        429,
        Number.isFinite(seconds) ? seconds : undefined,
      );
    }

    if (!res.ok) {
      const body = await res.text();
      let message = body;
      try {
        const parsed = JSON.parse(body);
        // A JSON body without a `.message` (e.g. a NestJS validation error
        // shaped like `{statusCode,error,details}`) must not fall back to the
        // raw JSON text — that would get rendered verbatim in the UI (#187).
        message = parsed.message ?? `Request failed (${res.status})`;
      } catch {
        // plain-text error body, use as-is
      }
      throw new ApiRequestError(message || `Request failed (${res.status})`, res.status);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Live-data fetchers that adapt mergefi-backend's nested TypeORM entity JSON
 * into the flat shapes the UI renders, falling back to mock data (already in
 * the target shape) when the backend is unreachable.
 */
export async function fetchBounties(fallback: Bounty[]): Promise<FetchResult<Bounty[]>> {
  try {
    const raw = await request<RawBounty[]>("/bounties");
    return { data: raw.map(adaptBounty), source: "live" };
  } catch {
    return { data: fallback, source: "mock" };
  }
}

export async function fetchBounty(
  id: string,
  fallback: Bounty | undefined,
): Promise<FetchResult<Bounty | undefined>> {
  try {
    const raw = await request<RawBounty>(`/bounties/${id}`);
    return { data: adaptBounty(raw), source: "live" };
  } catch {
    return { data: fallback, source: "mock" };
  }
}

export async function fetchMilestones(fallback: Milestone[]): Promise<FetchResult<Milestone[]>> {
  try {
    const raw = await request<RawMilestone[]>("/milestones");
    return { data: raw.map(adaptMilestone), source: "live" };
  } catch {
    return { data: fallback, source: "mock" };
  }
}

export async function fetchMaintenancePools(
  fallback: MaintenancePool[],
): Promise<FetchResult<MaintenancePool[]>> {
  try {
    const raw = await request<RawMaintenancePool[]>("/maintenance-pools");
    return { data: raw.map(adaptMaintenancePool), source: "live" };
  } catch {
    return { data: fallback, source: "mock" };
  }
}

export async function fetchReputationByUsername(
  username: string,
  fallback: ReputationProfile | null,
): Promise<FetchResult<ReputationProfile | null>> {
  try {
    const users = await request<(RawUserProfile & { id: string })[]>("/users");
    const target = username.toLowerCase();
    const user = users.find((u) => u.username.toLowerCase() === target);
    if (!user) return { data: fallback, source: "mock" };
    const snapshot = await request<RawReputationSnapshot | null>(
      `/reputation/${user.id}`,
    );
    return { data: adaptReputation(user, snapshot), source: "live" };
  } catch {
    return { data: fallback, source: "mock" };
  }
}

export async function fetchReputationHandles(fallback: string[]): Promise<FetchResult<string[]>> {
  try {
    const users = await request<(RawUserProfile & { id: string })[]>("/users");
    return { data: users.map((user) => user.username).filter(Boolean), source: "live" };
  } catch {
    return { data: fallback, source: "mock" };
  }
}
