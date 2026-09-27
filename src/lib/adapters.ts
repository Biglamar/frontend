import type {
  Bounty,
  Milestone,
  MaintenancePool,
  TeamSplit,
  Difficulty,
  ReputationProfile,
} from "@/types";
import {
  coerceDecimal,
  coerceNonNegative,
  coercePercentage,
  coerceStatus,
  validateTeamSplits,
} from "./utils";

// Shapes returned by mergefi-backend's TypeORM entities (see
// mergefi-backend/src/common/entities). These are intentionally loose since
// we only read the fields the UI needs.
interface RawRepository {
  owner: string;
  name: string;
}

interface RawUser {
  // Stable identifier, unlike username (a mutable GitHub handle) — carried
  // through separately on Bounty.claimedById so a profile link built from
  // a bounty survives the claimer renaming their GitHub account (#203).
  id?: string;
  username: string;
}

interface RawTeamSplit {
  role: string | null;
  percentage: string;
  user?: RawUser | null;
}

interface RawIssue {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  repository?: RawRepository;
  // Nested here, not on RawBounty: mergefi-backend's Bounty entity has no
  // milestoneId column at all — the milestone association lives on Issue
  // (Issue.milestoneId / Issue.milestone), which Bounty only reaches via
  // its one-to-one `issue` relation. See adaptBounty's doc comment (#86).
  milestoneId?: string | null;
}

export interface RawBounty {
  id: string;
  amount: string;
  asset: "USDC" | "XLM";
  difficulty: Difficulty;
  status: Bounty["status"];
  deadline: string | null;
  escrowId: string | null;
  issue?: RawIssue;
  claimedBy?: RawUser | null;
  team?: { splits?: RawTeamSplit[] } | null;
}

/**
 * Investigation notes for #86 (bounty-to-milestone cross-linking):
 *
 * - milestoneId was declared on the Bounty type but never set here — every
 *   Bounty this app constructed from live data had it permanently
 *   undefined. Fixed above by reading it from raw.issue.milestoneId, the
 *   shape confirmed against mergefi-backend's actual entities (there is no
 *   milestoneId on Bounty itself).
 * - Full field-by-field audit of Bounty vs. this function's return object
 *   (see adapters.test.ts's "field coverage" test) found milestoneId was
 *   the *only* field with this silent-drop bug; every other field,
 *   including the structurally-similar escrowId, was already mapped.
 * - Separately discovered while tracing this: mergefi-backend's
 *   `BountiesService.list()`/`findOne()` load bounties with no `relations`
 *   option at all, so `raw.issue`/`raw.claimedBy`/`raw.team` — and now
 *   `raw.issue.milestoneId` — are likely `undefined` on every live
 *   response today regardless of this fix, until that's corrected on the
 *   backend. Out of scope here (a different repo, and a much larger
 *   pre-existing gap than this issue's), but worth flagging since it
 *   affects whether this fix does anything observable yet in production.
 * - UI usage recommendation (#86 asks this be investigated, not
 *   necessarily implemented): IssueDetailPage gets a small "Part of a
 *   milestone" indicator below, since it already has the single Bounty
 *   object this field now lives on — no new fetch needed. MilestonesPage
 *   cross-linking to member bounties is recommended *against* for this
 *   PR: Milestone only carries aggregate issueCount/completedCount
 *   numbers today, and listing member bounties would need either a new
 *   backend endpoint (bounties filtered by milestoneId) or fetching every
 *   bounty on a funding-overview page just to filter client-side —
 *   real new scope, not a natural extension of restoring this mapping.
 */
/**
 * Returns the domain `Bounty` type. `teamSplitsValid` is declared on
 * `Bounty` itself (src/types/bounty.ts) rather than intersected onto this
 * function's return type: an adapter-local intersection is invisible to any
 * consumer typed as the plain `Bounty` (fetchBounties returns `Bounty[]`, so
 * every caller narrowed to that type structurally lost access to the field —
 * the type-level half of the "computed but never consumed" bug, where
 * adaptBounty computed and attached a validity flag that no component could
 * read).
 */
export function adaptBounty(raw: RawBounty): Bounty {
  const splits = raw.team?.splits?.map(
    (split): TeamSplit => ({
      role: split.role ?? "Contributor",
      percentage: coercePercentage(split.percentage),
      contributor: split.user?.username,
    }),
  );

  return {
    id: raw.id,
    repo: raw.issue?.repository?.name ?? "unknown-repo",
    org: raw.issue?.repository?.owner ?? "unknown-org",
    issueNumber: raw.issue?.number ?? 0,
    title: raw.issue?.title ?? "Untitled issue",
    description: raw.issue?.body ?? "",
    reward: coerceNonNegative(raw.amount),
    asset: raw.asset,
    difficulty: raw.difficulty,
    status: coerceStatus(raw.status),
    // A null deadline means the bounty is genuinely open-ended, not "due
    // now" — pass it through as-is rather than fabricating a "now"
    // timestamp that would make daysUntil() render it as already expired
    // (#193). Consumers must render a "No deadline" state for null.
    deadline: raw.deadline,
    labels: raw.issue?.labels ?? [],
    claimedBy: raw.claimedBy?.username,
    claimedById: raw.claimedBy?.id,
    milestoneId: raw.issue?.milestoneId ?? undefined,
    escrowId: raw.escrowId ?? undefined,
    teamSplits: splits,
    teamSplitsValid: splits ? validateTeamSplits(splits) : undefined,
  };
}

export interface RawMilestone {
  id: string;
  title: string;
  budget: string;
  distributed: string;
  asset: "USDC" | "XLM";
  repository?: RawRepository;
  issues?: { state: "open" | "closed" }[];
}

export function adaptMilestone(raw: RawMilestone): Milestone {
  const issues = raw.issues ?? [];
  return {
    id: raw.id,
    name: raw.title,
    repo: raw.repository ? `${raw.repository.owner}/${raw.repository.name}` : "unassigned",
    budget: coerceNonNegative(raw.budget),
    distributed: coerceNonNegative(raw.distributed),
    asset: raw.asset,
    issueCount: issues.length,
    completedCount: issues.filter((i) => i.state === "closed").length,
  };
}

export interface RawMaintenancePool {
  id: string;
  monthlyDeposit: string;
  balance: string;
  asset: "USDC" | "XLM";
  repository?: RawRepository | null;
}

export function adaptMaintenancePool(raw: RawMaintenancePool): MaintenancePool {
  return {
    id: raw.id,
    repo: raw.repository ? `${raw.repository.owner}/${raw.repository.name}` : "platform-wide",
    monthlyDeposit: coerceNonNegative(raw.monthlyDeposit),
    balance: coerceNonNegative(raw.balance),
    asset: raw.asset,
  };
}

export interface RawReputationSnapshot {
  totalEarnings: string;
  mergedPrCount: number;
  completionRate: string;
  avgReviewTimeHours: string;
  onTimeDeliveryPercentage: string;
  languages: Record<string, number>;
  orgsContributedTo: string[];
}

export interface RawUserProfile {
  username: string;
  avatarUrl: string | null;
  /**
   * mergefi-backend has no such field on its user entity yet. Read
   * defensively so this is a no-op until it lands, and so an explicitly
   * non-public profile can never be indexed by omission: anything other than
   * `true` means "not indexable" (see src/lib/seo-policy.ts).
   */
  isProfilePublic?: boolean | null;
}

export function adaptReputation(
  user: RawUserProfile,
  snapshot: RawReputationSnapshot | null,
): ReputationProfile {
  return {
    handle: user.username,
    avatarUrl:
      user.avatarUrl ??
      `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(user.username)}`,
    lifetimeEarnings: snapshot ? coerceNonNegative(snapshot.totalEarnings) : 0,
    mergedPRs: snapshot?.mergedPrCount ?? 0,
    completionRate: snapshot ? coerceDecimal(snapshot.completionRate) / 100 : 0,
    avgReviewTimeHours: snapshot ? coerceNonNegative(snapshot.avgReviewTimeHours) : 0,
    onTimeDeliveryRate: snapshot ? coerceDecimal(snapshot.onTimeDeliveryPercentage) / 100 : 0,
    // Object.keys() alone discards the usage weight and returns keys in
    // insertion order, not "most used first" — sort by value descending so
    // the rendered badge order actually means something (#196).
    languages: snapshot
      ? Object.entries(snapshot.languages)
          .sort(([, a], [, b]) => b - a)
          .map(([lang]) => lang)
      : [],
    organizations: snapshot?.orgsContributedTo ?? [],
    indexable: user.isProfilePublic === true,
  };
}
