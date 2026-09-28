/**
 * bounty-query.test.ts (#28)
 *
 * Covers the filter/sort/pagination pipeline that backs the bounty board's
 * URL-driven query params: parsing degrades bad input instead of erroring,
 * filtering/sorting/pagination compose correctly, and href-building merges
 * overrides onto the current query while resetting `page`.
 */

import {
  applyBountyQuery,
  buildBountyQueryString,
  buildIssuesHref,
  filterBounties,
  isFilterActive,
  parseBountyQuery,
} from "./bounty-query";
import type { Bounty } from "@/types";

function bounty(overrides: Partial<Bounty>): Bounty {
  return {
    id: "b1",
    title: "t",
    description: "d",
    reward: 100,
    asset: "USDC",
    difficulty: "intermediate",
    status: "open",
    org: "org",
    repo: "repo",
    issueNumber: 1,
    labels: [],
    deadline: null,
    ...overrides,
  };
}

describe("parseBountyQuery", () => {
  it("defaults every field when params are empty", () => {
    expect(parseBountyQuery({})).toEqual({
      status: "all",
      difficulty: "all",
      asset: "all",
      minReward: undefined,
      maxReward: undefined,
      sort: "default",
      page: 1,
    });
  });

  it("degrades an unrecognized enum value to its default instead of erroring", () => {
    const query = parseBountyQuery({ status: "bogus", difficulty: "wizard", asset: "BTC" });
    expect(query.status).toBe("all");
    expect(query.difficulty).toBe("all");
    expect(query.asset).toBe("all");
  });

  it("clamps a non-numeric or sub-1 page to 1", () => {
    expect(parseBountyQuery({ page: "not-a-number" }).page).toBe(1);
    expect(parseBountyQuery({ page: "0" }).page).toBe(1);
    expect(parseBountyQuery({ page: "-5" }).page).toBe(1);
  });

  it("parses a valid page number", () => {
    expect(parseBountyQuery({ page: "3" }).page).toBe(3);
  });

  it("drops an inverted reward range's max instead of producing an always-empty filter", () => {
    const query = parseBountyQuery({ minReward: "200", maxReward: "50" });
    expect(query.minReward).toBe(200);
    expect(query.maxReward).toBeUndefined();
  });

  it("ignores a negative or non-numeric reward bound", () => {
    expect(parseBountyQuery({ minReward: "-10" }).minReward).toBeUndefined();
    expect(parseBountyQuery({ maxReward: "nope" }).maxReward).toBeUndefined();
  });

  it("takes the first value when a param repeats", () => {
    expect(parseBountyQuery({ status: ["open", "in_review"] }).status).toBe("open");
  });
});

describe("isFilterActive", () => {
  it("is false for the all-defaults query", () => {
    expect(isFilterActive(parseBountyQuery({}))).toBe(false);
  });

  it("is true when any facet is set", () => {
    expect(isFilterActive(parseBountyQuery({ difficulty: "beginner" }))).toBe(true);
    expect(isFilterActive(parseBountyQuery({ minReward: "10" }))).toBe(true);
  });
});

describe("filterBounties", () => {
  const bounties = [
    bounty({ id: "a", status: "open", difficulty: "beginner", asset: "USDC", reward: 50 }),
    bounty({ id: "b", status: "in_review", difficulty: "expert", asset: "XLM", reward: 500 }),
    bounty({ id: "c", status: "open", difficulty: "advanced", asset: "USDC", reward: 200 }),
  ];

  it("combines status, difficulty, asset and reward-range filters", () => {
    const result = filterBounties(bounties, {
      status: "open",
      difficulty: "all",
      asset: "USDC",
      minReward: 100,
      maxReward: 300,
      sort: "default",
      page: 1,
    });
    expect(result.map((b) => b.id)).toEqual(["c"]);
  });

  it("returns everything when no facet is active", () => {
    const result = filterBounties(bounties, {
      status: "all",
      difficulty: "all",
      asset: "all",
      sort: "default",
      page: 1,
    });
    expect(result).toHaveLength(3);
  });
});

describe("applyBountyQuery", () => {
  const bounties = Array.from({ length: 25 }, (_, i) =>
    bounty({ id: `b${i}`, reward: i, deadline: null }),
  );

  it("paginates with the given page size", () => {
    const result = applyBountyQuery(
      bounties,
      { status: "all", difficulty: "all", asset: "all", sort: "default", page: 1 },
      10,
    );
    expect(result.items).toHaveLength(10);
    expect(result.totalPages).toBe(3);
    expect(result.filteredCount).toBe(25);
  });

  it("clamps a page number beyond the last page to the last page", () => {
    const result = applyBountyQuery(
      bounties,
      { status: "all", difficulty: "all", asset: "all", sort: "default", page: 999 },
      10,
    );
    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(5);
  });

  it("sorts by reward descending", () => {
    const result = applyBountyQuery(
      bounties,
      { status: "all", difficulty: "all", asset: "all", sort: "reward-desc", page: 1 },
      10,
    );
    expect(result.items[0].reward).toBe(24);
  });

  it("puts bounties without a deadline last when sorting by soonest deadline", () => {
    const withDeadlines = [
      bounty({ id: "x", deadline: null, reward: 1 }),
      bounty({ id: "y", deadline: new Date(Date.now() + 86400000).toISOString(), reward: 2 }),
      bounty({ id: "z", deadline: new Date(Date.now() + 3600000).toISOString(), reward: 3 }),
    ];
    const result = applyBountyQuery(
      withDeadlines,
      { status: "all", difficulty: "all", asset: "all", sort: "deadline-asc", page: 1 },
      10,
    );
    expect(result.items.map((b) => b.id)).toEqual(["z", "y", "x"]);
  });
});

describe("buildBountyQueryString", () => {
  it("omits every param at its default", () => {
    expect(
      buildBountyQueryString({
        status: "all",
        difficulty: "all",
        asset: "all",
        sort: "default",
        page: 1,
      }),
    ).toBe("");
  });

  it("includes only the non-default params", () => {
    const qs = buildBountyQueryString({
      status: "open",
      difficulty: "all",
      asset: "USDC",
      minReward: 50,
      sort: "default",
      page: 1,
    });
    expect(qs).toBe("?status=open&asset=USDC&minReward=50");
  });
});

describe("buildIssuesHref", () => {
  it("returns the bare path when nothing is active", () => {
    expect(buildIssuesHref({}, {})).toBe("/issues");
  });

  it("merges an override onto the current params", () => {
    expect(buildIssuesHref({ status: "open" }, { difficulty: "beginner" })).toBe(
      "/issues?status=open&difficulty=beginner",
    );
  });

  it("resets page to 1 when a non-page override is applied", () => {
    expect(buildIssuesHref({ status: "open", page: "4" }, { difficulty: "beginner" })).toBe(
      "/issues?status=open&difficulty=beginner",
    );
  });

  it("preserves an explicit page override", () => {
    expect(buildIssuesHref({ status: "open" }, { page: "2" })).toBe(
      "/issues?status=open&page=2",
    );
  });

  it("clearing a facet back to its default drops it from the URL", () => {
    expect(buildIssuesHref({ status: "open" }, { status: undefined })).toBe("/issues");
  });
});
