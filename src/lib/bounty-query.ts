import type { Bounty } from "@/types";

/**
 * URL-driven filter/sort/pagination contract for the bounty board (#28).
 *
 * The backend's `/bounties` endpoint does not currently accept query
 * params (verified: `RawBounty[]` comes back unfiltered regardless of what
 * `fetchBounties` forwards), so this module also doubles as the enforcement
 * point: `applyBountyQuery` is run against whatever `fetchBounties` returns
 * — live or mock — so filtering/sorting/pagination is always correct
 * without depending on backend support landing first. If/when the backend
 * does start honoring these params server-side, applying this filter again
 * here is a no-op on already-filtered data, so nothing needs to change on
 * the frontend to benefit from it (only the unfiltered-payload-size win
 * requires removing the client-side pass).
 */

export const PAGE_SIZE = 10;

export const STATUS_VALUES = ["all", "open", "in_review"] as const;
export type StatusFilter = (typeof STATUS_VALUES)[number];

export const DIFFICULTY_VALUES = [
  "all",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;
export type DifficultyFilter = (typeof DIFFICULTY_VALUES)[number];

export const ASSET_VALUES = ["all", "USDC", "XLM"] as const;
export type AssetFilter = (typeof ASSET_VALUES)[number];

export const SORT_VALUES = ["default", "reward-desc", "reward-asc", "deadline-asc"] as const;
export type SortOption = (typeof SORT_VALUES)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  default: "Newest",
  "reward-desc": "Reward: high to low",
  "reward-asc": "Reward: low to high",
  "deadline-asc": "Deadline: soonest",
};

export interface BountyQuery {
  status: StatusFilter;
  difficulty: DifficultyFilter;
  asset: AssetFilter;
  minReward?: number;
  maxReward?: number;
  sort: SortOption;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function coerceEnum<T extends string>(
  raw: string | string[] | undefined,
  values: readonly T[],
  fallback: T,
): T {
  const value = firstParam(raw);
  return (values as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

function coerceNonNegativeNumber(raw: string | string[] | undefined): number | undefined {
  const value = firstParam(raw);
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function coercePage(raw: string | string[] | undefined): number {
  const value = firstParam(raw);
  const n = value !== undefined ? parseInt(value, 10) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Parses raw `searchParams` into a normalized query, degrading invalid or
 * out-of-range values (unrecognized enum values, a non-numeric page, an
 * inverted min/max reward range) to sensible defaults instead of erroring.
 */
export function parseBountyQuery(params: RawSearchParams): BountyQuery {
  const minReward = coerceNonNegativeNumber(params.minReward);
  const maxRewardRaw = coerceNonNegativeNumber(params.maxReward);
  // An inverted range (min > max) can't ever match — treat it as "no max"
  // rather than silently producing a permanently-empty result set.
  const maxReward =
    minReward !== undefined && maxRewardRaw !== undefined && maxRewardRaw < minReward
      ? undefined
      : maxRewardRaw;

  return {
    status: coerceEnum(params.status, STATUS_VALUES, "all"),
    difficulty: coerceEnum(params.difficulty, DIFFICULTY_VALUES, "all"),
    asset: coerceEnum(params.asset, ASSET_VALUES, "all"),
    minReward,
    maxReward,
    sort: coerceEnum(params.sort, SORT_VALUES, "default"),
    page: coercePage(params.page),
  };
}

export function isFilterActive(query: BountyQuery): boolean {
  return (
    query.status !== "all" ||
    query.difficulty !== "all" ||
    query.asset !== "all" ||
    query.minReward !== undefined ||
    query.maxReward !== undefined
  );
}

export function filterBounties(bounties: Bounty[], query: BountyQuery): Bounty[] {
  return bounties.filter((b) => {
    if (query.status !== "all" && b.status !== query.status) return false;
    if (query.difficulty !== "all" && b.difficulty !== query.difficulty) return false;
    if (query.asset !== "all" && b.asset !== query.asset) return false;
    if (query.minReward !== undefined && b.reward < query.minReward) return false;
    if (query.maxReward !== undefined && b.reward > query.maxReward) return false;
    return true;
  });
}

function sortBounties(bounties: Bounty[], sort: SortOption): Bounty[] {
  const sorted = [...bounties];
  switch (sort) {
    case "reward-desc":
      sorted.sort((a, b) => b.reward - a.reward);
      break;
    case "reward-asc":
      sorted.sort((a, b) => a.reward - b.reward);
      break;
    case "deadline-asc":
      sorted.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      break;
    case "default":
      break;
  }
  return sorted;
}

export interface BountyQueryResult {
  items: Bounty[];
  page: number;
  totalPages: number;
  /** Count after filtering, before pagination — what "N of total" reports. */
  filteredCount: number;
}

/**
 * Applies the full filter → sort → paginate pipeline. An out-of-range page
 * (too high, zero, negative, non-numeric) clamps to the nearest valid page
 * rather than rendering an error or a blank page.
 */
export function applyBountyQuery(
  bounties: Bounty[],
  query: BountyQuery,
  pageSize = PAGE_SIZE,
): BountyQueryResult {
  const filtered = filterBounties(bounties, query);
  const sorted = sortBounties(filtered, query.sort);
  const filteredCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    page,
    totalPages,
    filteredCount,
  };
}

/**
 * Forwards the filter/sort contract to the backend as query params, ahead
 * of backend support existing, so the frontend needs no further change once
 * `/bounties` starts honoring them server-side (#28).
 */
export function buildBountyQueryString(query: BountyQuery): string {
  const sp = new URLSearchParams();
  if (query.status !== "all") sp.set("status", query.status);
  if (query.difficulty !== "all") sp.set("difficulty", query.difficulty);
  if (query.asset !== "all") sp.set("asset", query.asset);
  if (query.minReward !== undefined) sp.set("minReward", String(query.minReward));
  if (query.maxReward !== undefined) sp.set("maxReward", String(query.maxReward));
  if (query.sort !== "default") sp.set("sort", query.sort);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Builds an `/issues` href that merges `overrides` into the current query
 * params, dropping any param back to its default (omitted from the URL).
 * Changing a filter always resets `page` back to 1, since the previous
 * page number is unlikely to still be valid against the new result set.
 */
export function buildIssuesHref(
  current: RawSearchParams,
  overrides: Partial<Record<keyof BountyQuery, string | undefined>>,
): string {
  const keys: (keyof BountyQuery)[] = [
    "status",
    "difficulty",
    "asset",
    "minReward",
    "maxReward",
    "sort",
    "page",
  ];
  const defaults: Record<string, string> = {
    status: "all",
    difficulty: "all",
    asset: "all",
    sort: "default",
    page: "1",
  };
  const resetsPage = Object.keys(overrides).some((k) => k !== "page");
  const sp = new URLSearchParams();
  for (const key of keys) {
    const value =
      key in overrides
        ? overrides[key]
        : key === "page" && resetsPage
          ? "1"
          : firstParam(current[key]);
    if (value === undefined || value === "") continue;
    if (defaults[key] === value) continue;
    sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `/issues?${qs}` : "/issues";
}
