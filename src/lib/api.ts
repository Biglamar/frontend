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
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new ApiUnavailableError(`Request to ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const REQUEST_TIMEOUT_MS = 20_000;

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
}

export function apiPost<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

/**
 * Live-data fetchers that adapt mergefi-backend's nested TypeORM entity JSON
 * into the flat shapes the UI renders, falling back to mock data (already in
 * the target shape) when the backend is unreachable.
 */
export async function fetchBounties(fallback: Bounty[]): Promise<Bounty[]> {
  try {
    const raw = await request<RawBounty[]>("/bounties");
    return raw.map(adaptBounty);
  } catch {
    return fallback;
  }
}

export async function fetchBounty(
  id: string,
  fallback: Bounty | undefined,
): Promise<Bounty | undefined> {
  try {
    const raw = await request<RawBounty>(`/bounties/${id}`);
    return adaptBounty(raw);
  } catch {
    return fallback;
  }
}

export async function fetchMilestones(fallback: Milestone[]): Promise<Milestone[]> {
  try {
    const raw = await request<RawMilestone[]>("/milestones");
    return raw.map(adaptMilestone);
  } catch {
    return fallback;
  }
}

export async function fetchMaintenancePools(
  fallback: MaintenancePool[],
): Promise<MaintenancePool[]> {
  try {
    const raw = await request<RawMaintenancePool[]>("/maintenance-pools");
    return raw.map(adaptMaintenancePool);
  } catch {
    return fallback;
  }
}

export async function fetchReputationByUsername(
  username: string,
  fallback: ReputationProfile | null,
): Promise<ReputationProfile | null> {
  try {
    const users = await request<(RawUserProfile & { id: string })[]>("/users");
    // GitHub usernames are canonically case-insensitive (torvalds and
    // Torvalds resolve to the same account) — a strict === comparison
    // 404s a profile that genuinely exists under different letter casing
    // (#245).
    const target = username.toLowerCase();
    const user = users.find((u) => u.username.toLowerCase() === target);
    if (!user) return fallback;
    const snapshot = await request<RawReputationSnapshot | null>(
      `/reputation/${user.id}`,
    );
    return adaptReputation(user, snapshot);
  } catch {
    return fallback;
  }
}

export async function fetchReputationHandles(fallback: string[]): Promise<string[]> {
  try {
    const users = await request<(RawUserProfile & { id: string })[]>("/users");
    return users.map((user) => user.username).filter(Boolean);
  } catch {
    return fallback;
  }
}
