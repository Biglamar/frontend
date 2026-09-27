/**
 * adapters.test.ts
 *
 * Tests for adaptBounty's mapping of milestoneId (#86) — declared on the
 * Bounty type but never actually set by adaptBounty prior to this fix.
 *
 * Also covers adaptMilestone, adaptMaintenancePool, and adaptReputation
 * (#197) — previously the only three of this module's four exports with no
 * dedicated test at all, despite being the sole seam between
 * mergefi-backend's raw entity JSON and every number the milestones page,
 * maintenance-pool cards, and reputation profile page render.
 */

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
import type { Bounty } from "@/types";

function rawBounty(overrides: Partial<RawBounty> = {}): RawBounty {
  return {
    id: "bounty-1",
    amount: "500",
    asset: "USDC",
    difficulty: "intermediate",
    status: "open",
    deadline: "2026-01-01T00:00:00.000Z",
    escrowId: null,
    issue: {
      number: 42,
      title: "Fix the thing",
      body: "Description",
      labels: ["bug"],
      repository: { owner: "acme", name: "widgets" },
    },
    ...overrides,
  };
}

describe("adaptBounty — milestoneId mapping (#86)", () => {
  it("maps milestoneId from the nested issue when the issue belongs to a milestone", () => {
    const raw = rawBounty({
      issue: {
        number: 42,
        title: "Fix the thing",
        body: "Description",
        labels: ["bug"],
        repository: { owner: "acme", name: "widgets" },
        milestoneId: "milestone-7",
      },
    });

    expect(adaptBounty(raw).milestoneId).toBe("milestone-7");
  });

  it("leaves milestoneId undefined when the issue has no milestone association", () => {
    // issue.milestoneId omitted entirely — the realistic shape for most
    // issues, which aren't part of any milestone.
    const raw = rawBounty();
    expect(adaptBounty(raw).milestoneId).toBeUndefined();
  });

  it("normalizes a null milestoneId (no association) the same as an omitted one", () => {
    // mergefi-backend's Issue.milestoneId is a nullable column, so the
    // real backend response says "no milestone" via `null`, not by
    // omitting the key entirely.
    const raw = rawBounty({
      issue: {
        number: 42,
        title: "Fix the thing",
        body: "Description",
        labels: ["bug"],
        repository: { owner: "acme", name: "widgets" },
        milestoneId: null,
      },
    });

    expect(adaptBounty(raw).milestoneId).toBeUndefined();
  });

  it("leaves milestoneId undefined when the bounty has no issue at all", () => {
    const raw = rawBounty({ issue: undefined });
    expect(adaptBounty(raw).milestoneId).toBeUndefined();
  });
});

describe("adaptBounty — claimedById mapping (#203)", () => {
  it("maps claimedById from the claimer's stable id alongside the display username", () => {
    const raw = rawBounty({ claimedBy: { id: "user-1", username: "alice" } });
    const bounty = adaptBounty(raw);
    expect(bounty.claimedBy).toBe("alice");
    expect(bounty.claimedById).toBe("user-1");
  });

  it("leaves claimedById undefined when the bounty is unclaimed", () => {
    const raw = rawBounty({ claimedBy: undefined });
    expect(adaptBounty(raw).claimedById).toBeUndefined();
  });
});

describe("adaptBounty — sponsorId mapping", () => {
  it("passes the sponsor's stable id straight through", () => {
    const raw = rawBounty({ sponsorId: "sponsor-1" });
    expect(adaptBounty(raw).sponsorId).toBe("sponsor-1");
  });

  it("normalizes a null sponsorId to undefined", () => {
    // Nullable column: "no sponsor on file" is reported as `null`.
    expect(adaptBounty(rawBounty({ sponsorId: null })).sponsorId).toBeUndefined();
  });

  it("leaves sponsorId undefined when the key is absent entirely", () => {
    expect(adaptBounty(rawBounty({ sponsorId: undefined })).sponsorId).toBeUndefined();
  });
});

describe("adaptBounty — field coverage audit (#86)", () => {
  // Every key the Bounty interface declares (src/types/index.ts). Kept as
  // an explicit list, checked against adaptBounty's actual output below,
  // so a future field added to Bounty but never mapped here — exactly
  // milestoneId's bug — fails this test instead of silently shipping.
  const EXPECTED_BOUNTY_FIELDS = [
    "id",
    "repo",
    "org",
    "issueNumber",
    "title",
    "description",
    "reward",
    "asset",
    "difficulty",
    "status",
    "deadline",
    "labels",
    "claimedBy",
    "claimedById",
    "sponsorId",
    "teamSplits",
    "teamSplitsValid",
    "milestoneId",
    "escrowId",
  ] as const;

  it("sets every Bounty field to a defined value given a fully-populated raw bounty", () => {
    const raw = rawBounty({
      escrowId: "escrow-1",
      sponsorId: "sponsor-1",
      claimedBy: { id: "user-1", username: "alice" },
      team: { splits: [{ role: "Lead", percentage: "100", user: { username: "alice" } }] },
      issue: {
        number: 42,
        title: "Fix the thing",
        body: "Description",
        labels: ["bug"],
        repository: { owner: "acme", name: "widgets" },
        milestoneId: "milestone-7",
      },
    });

    const bounty = adaptBounty(raw);

    for (const field of EXPECTED_BOUNTY_FIELDS) {
      expect(bounty[field]).not.toBeUndefined();
    }
  });
});

/**
 * teamSplitsValid is declared on the Bounty type itself and read by
 * IssueDetailPage. It used to be intersected onto adaptBounty's return type
 * only, so consumers typed as plain `Bounty` (fetchBounties returns Bounty[])
 * had no access to it at the type level (#419).
 */
describe("adaptBounty — teamSplitsValid", () => {
  it("surfaces the flag through the plain Bounty type, not an adapter-local one", () => {
    const bounty: Bounty = adaptBounty(
      rawBounty({
        team: { splits: [{ role: "Lead", percentage: "60" }, { role: "Dev", percentage: "40" }] },
      }),
    );

    expect(bounty.teamSplitsValid).toEqual({ valid: true, sum: 100 });
  });

  it("reports invalid splits with validateTeamSplits' message", () => {
    const bounty: Bounty = adaptBounty(
      rawBounty({
        team: { splits: [{ role: "Lead", percentage: "50" }, { role: "Dev", percentage: "35" }] },
      }),
    );

    expect(bounty.teamSplitsValid).toEqual({
      valid: false,
      sum: 85,
      message: "Team splits sum to 85.00% (expected 100%)",
    });
  });

  it("leaves the flag undefined for a bounty with no team", () => {
    const bounty: Bounty = adaptBounty(rawBounty({ team: null }));

    expect(bounty.teamSplits).toBeUndefined();
    expect(bounty.teamSplitsValid).toBeUndefined();
  });

  it("treats an empty splits array as valid with a zero sum, not as invalid", () => {
    const bounty: Bounty = adaptBounty(rawBounty({ team: { splits: [] } }));

    expect(bounty.teamSplits).toEqual([]);
    expect(bounty.teamSplitsValid).toEqual({ valid: true, sum: 0 });
  });
});

// ─── adaptMilestone (#197) ─────────────────────────────────────────────────

function rawMilestone(overrides: Partial<RawMilestone> = {}): RawMilestone {
  return {
    id: "milestone-1",
    title: "v2.0 launch",
    budget: "5000",
    distributed: "2000",
    asset: "USDC",
    repository: { owner: "acme", name: "widgets" },
    issues: [{ state: "closed" }, { state: "closed" }, { state: "open" }],
    ...overrides,
  };
}

describe("adaptMilestone", () => {
  it("derives issueCount and completedCount from raw.issues", () => {
    const milestone = adaptMilestone(rawMilestone());
    expect(milestone.issueCount).toBe(3);
    expect(milestone.completedCount).toBe(2);
  });

  it("defaults issueCount/completedCount to 0 when raw.issues is absent", () => {
    const milestone = adaptMilestone(rawMilestone({ issues: undefined }));
    expect(milestone.issueCount).toBe(0);
    expect(milestone.completedCount).toBe(0);
  });

  it("joins repository owner/name, or falls back to \"unassigned\"", () => {
    expect(adaptMilestone(rawMilestone()).repo).toBe("acme/widgets");
    expect(adaptMilestone(rawMilestone({ repository: undefined })).repo).toBe("unassigned");
  });

  it("sets every Milestone field to a defined value given a fully-populated raw milestone", () => {
    const milestone = adaptMilestone(rawMilestone());
    for (const field of [
      "id",
      "name",
      "repo",
      "budget",
      "distributed",
      "asset",
      "issueCount",
      "completedCount",
    ] as const) {
      expect(milestone[field]).not.toBeUndefined();
    }
  });
});

// ─── adaptMaintenancePool (#197) ───────────────────────────────────────────

function rawMaintenancePool(
  overrides: Partial<RawMaintenancePool> = {},
): RawMaintenancePool {
  return {
    id: "pool-1",
    monthlyDeposit: "500",
    balance: "3000",
    asset: "USDC",
    repository: { owner: "acme", name: "widgets" },
    ...overrides,
  };
}

describe("adaptMaintenancePool", () => {
  it("joins repository owner/name, or falls back to \"platform-wide\" when null", () => {
    expect(adaptMaintenancePool(rawMaintenancePool()).repo).toBe("acme/widgets");
    expect(
      adaptMaintenancePool(rawMaintenancePool({ repository: null })).repo,
    ).toBe("platform-wide");
  });

  it("sets every MaintenancePool field to a defined value given a fully-populated raw pool", () => {
    const pool = adaptMaintenancePool(rawMaintenancePool());
    for (const field of ["id", "repo", "monthlyDeposit", "balance", "asset"] as const) {
      expect(pool[field]).not.toBeUndefined();
    }
  });
});

// ─── adaptReputation (#197) ────────────────────────────────────────────────

function rawUserProfile(overrides: Partial<RawUserProfile> = {}): RawUserProfile {
  return {
    username: "devrel_ana",
    avatarUrl: null,
    ...overrides,
  };
}

function rawReputationSnapshot(
  overrides: Partial<RawReputationSnapshot> = {},
): RawReputationSnapshot {
  return {
    totalEarnings: "8420",
    mergedPrCount: 61,
    completionRate: "94",
    avgReviewTimeHours: "14",
    onTimeDeliveryPercentage: "88",
    languages: { Rust: 12, TypeScript: 40, Go: 3 },
    orgsContributedTo: ["stellar-labs"],
    ...overrides,
  };
}

describe("adaptReputation", () => {
  it("divides completionRate/onTimeDeliveryRate by 100 into a 0-1 fraction", () => {
    const profile = adaptReputation(rawUserProfile(), rawReputationSnapshot());
    expect(profile.completionRate).toBeCloseTo(0.94);
    expect(profile.onTimeDeliveryRate).toBeCloseTo(0.88);
  });

  // The search-engine opt-in mapped from the backend's `isProfilePublic`
  // (see src/lib/seo-policy.ts). Only an explicit `true` may enable indexing.
  it.each([
    [true, true],
    [false, false],
    [null, false],
    [undefined, false],
  ])("maps isProfilePublic %p to indexable %p", (isProfilePublic, expected) => {
    const profile = adaptReputation(
      rawUserProfile({ isProfilePublic }),
      rawReputationSnapshot(),
    );
    expect(profile.indexable).toBe(expected);
  });

  it("returns zeroed fields when there is no snapshot", () => {
    const profile = adaptReputation(rawUserProfile(), null);
    expect(profile.lifetimeEarnings).toBe(0);
    expect(profile.mergedPRs).toBe(0);
    expect(profile.completionRate).toBe(0);
    expect(profile.avgReviewTimeHours).toBe(0);
    expect(profile.onTimeDeliveryRate).toBe(0);
    expect(profile.languages).toEqual([]);
    expect(profile.organizations).toEqual([]);
  });

  it("sorts languages by usage weight descending, not object-key insertion order", () => {
    const profile = adaptReputation(rawUserProfile(), rawReputationSnapshot());
    expect(profile.languages).toEqual(["TypeScript", "Rust", "Go"]);
  });

  it("escapes the username when falling back to a generated dicebear avatar URL", () => {
    const profile = adaptReputation(rawUserProfile({ username: "a&b" }), null);
    expect(profile.avatarUrl).toContain("seed=a%26b");
    expect(profile.avatarUrl).not.toContain("seed=a&b");
  });

  it("uses the provided avatarUrl instead of generating one when present", () => {
    const profile = adaptReputation(
      rawUserProfile({ avatarUrl: "https://avatars.githubusercontent.com/u/1" }),
      null,
    );
    expect(profile.avatarUrl).toBe("https://avatars.githubusercontent.com/u/1");
  });

  it("sets every ReputationProfile field to a defined value given a fully-populated snapshot", () => {
    const profile = adaptReputation(rawUserProfile(), rawReputationSnapshot());
    for (const field of [
      "handle",
      "avatarUrl",
      "lifetimeEarnings",
      "mergedPRs",
      "completionRate",
      "avgReviewTimeHours",
      "onTimeDeliveryRate",
      "languages",
      "organizations",
    ] as const) {
      expect(profile[field]).not.toBeUndefined();
    }
  });
});
