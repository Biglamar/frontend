import type {
  Bounty,
  Milestone,
  ReputationProfile,
  MaintenancePool,
} from "@/types";

export const mockBounties: Bounty[] = [
  {
    id: "b1",
    repo: "stellar-wallet-kit",
    org: "stellar-labs",
    issueNumber: 482,
    title: "Fix wallet reconnect race condition on network switch",
    description:
      "Switching between testnet and mainnet while a Freighter session is active can leave the app in a stale connection state. Needs a fix in the wallet provider's effect cleanup.",
    reward: 150,
    asset: "USDC",
    difficulty: "intermediate",
    status: "open",
    deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
    labels: ["bug", "wallet", "good-first-issue"],
  },
  {
    id: "b2",
    repo: "soroban-escrow-sdk",
    org: "mergefi",
    issueNumber: 17,
    title: "Add milestone allocation validation to escrow client",
    description:
      "Client-side helper should reject milestone allocations that exceed the remaining pool budget before submitting the transaction.",
    reward: 220,
    asset: "USDC",
    difficulty: "intermediate",
    status: "claimed",
    deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
    labels: ["sdk", "enhancement"],
    claimedBy: "0xkoda",
  },
  {
    id: "b3",
    repo: "docs-site",
    org: "mergefi",
    issueNumber: 9,
    title: "Document Soroban escrow contract API reference",
    description:
      "Write reference docs for fund/release/refund functions including auth requirements and error codes.",
    // XLM-denominated (#367) so the demo exercises 7-decimal XLM formatting.
    reward: 1250.5,
    asset: "XLM",
    difficulty: "beginner",
    status: "open",
    deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
    labels: ["docs", "good-first-issue"],
  },
  {
    id: "b4",
    repo: "core-indexer",
    org: "stellar-labs",
    issueNumber: 301,
    title: "Optimize ledger ingestion batch size for large repos",
    description:
      "Current batching causes memory spikes on repos with >50k merged PRs. Needs profiling and a streaming rewrite.",
    reward: 480,
    asset: "USDC",
    difficulty: "advanced",
    status: "in_review",
    deadline: new Date(Date.now() + 1 * 86400000).toISOString(),
    labels: ["performance", "backend"],
    claimedBy: "priyaeth",
    teamSplits: [
      { role: "Backend", percentage: 70, contributor: "priyaeth" },
      { role: "Testing", percentage: 30, contributor: "qa_marcus" },
    ],
  },
  {
    id: "b5",
    repo: "core-indexer",
    org: "stellar-labs",
    issueNumber: 288,
    title: "Upgrade dependency set for Node 22 compatibility",
    description: "Routine maintenance bounty funded from the recurring pool.",
    reward: 40,
    asset: "USDC",
    difficulty: "beginner",
    status: "paid",
    deadline: new Date(Date.now() - 2 * 86400000).toISOString(),
    labels: ["maintenance"],
    claimedBy: "devrel_ana",
  },
];

export const mockMilestones: Milestone[] = [
  {
    id: "m1",
    name: "v2.0: Multi-asset escrow",
    repo: "soroban-escrow-sdk",
    budget: 12000,
    distributed: 4300,
    asset: "USDC",
    issueCount: 12,
    completedCount: 4,
  },
  {
    id: "m2",
    name: "v1.4: Indexer performance pass",
    repo: "core-indexer",
    // XLM-denominated (#367): XLM trades far below 1 USD, so budgets are larger.
    budget: 48000,
    distributed: 16837.25,
    asset: "XLM",
    issueCount: 8,
    completedCount: 3,
  },
];

export const mockMaintenancePools: MaintenancePool[] = [
  {
    id: "p1",
    repo: "core-indexer",
    monthlyDeposit: 500,
    balance: 1240,
    asset: "USDC",
  },
  {
    // XLM-denominated (#367); balance carries full 7-decimal stroop precision.
    id: "p2",
    repo: "stellar-wallet-kit",
    monthlyDeposit: 2500,
    balance: 8412.1234567,
    asset: "XLM",
  },
];

export const mockReputationProfiles: Record<string, ReputationProfile> = {
  priyaeth: {
    handle: "priyaeth",
    avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    lifetimeEarnings: 8420,
    mergedPRs: 61,
    completionRate: 0.94,
    avgReviewTimeHours: 14,
    onTimeDeliveryRate: 0.88,
    languages: ["Rust", "TypeScript", "Go"],
    organizations: ["stellar-labs", "mergefi"],
    // Demo fixtures stand in for contributors who have opted into search-engine
    // indexing, so local dev exercises the sitemap path the backend flag will
    // drive in production (see src/lib/seo-policy.ts).
    indexable: true,
  },
  "0xkoda": {
    handle: "0xkoda",
    avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
    lifetimeEarnings: 3210,
    mergedPRs: 27,
    completionRate: 0.9,
    avgReviewTimeHours: 20,
    onTimeDeliveryRate: 0.81,
    languages: ["Rust", "Solidity"],
    organizations: ["mergefi"],
    indexable: true,
  },
  devrel_ana: {
    handle: "devrel_ana",
    avatarUrl: "https://avatars.githubusercontent.com/u/3?v=4",
    lifetimeEarnings: 2890,
    mergedPRs: 24,
    completionRate: 0.88,
    avgReviewTimeHours: 18,
    onTimeDeliveryRate: 0.85,
    languages: ["TypeScript", "JavaScript"],
    organizations: ["stellar-labs"],
    indexable: true,
  },
  qa_marcus: {
    handle: "qa_marcus",
    avatarUrl: "https://avatars.githubusercontent.com/u/4?v=4",
    lifetimeEarnings: 2140,
    mergedPRs: 19,
    completionRate: 0.92,
    avgReviewTimeHours: 12,
    onTimeDeliveryRate: 0.9,
    languages: ["Go", "Python"],
    organizations: ["stellar-labs", "mergefi"],
    // Demo fixtures stand in for contributors who have opted into search-engine
    // indexing, so local dev exercises the sitemap path the backend flag will
    // drive in production (see src/lib/seo-policy.ts).
    indexable: true,
  },
  linh_dev: {
    handle: "linh_dev",
    avatarUrl: "https://avatars.githubusercontent.com/u/5?v=4",
    lifetimeEarnings: 1780,
    mergedPRs: 15,
    completionRate: 0.86,
    avgReviewTimeHours: 22,
    onTimeDeliveryRate: 0.78,
    languages: ["TypeScript", "Rust"],
    organizations: ["mergefi"],
    indexable: true,
  },
};

// Not modeled in types/index.ts alongside Bounty/Milestone/etc: this shape
// only ever backs the signed-out demo title on the sponsor dashboard and
// has no corresponding backend endpoint or adapter (#202) — keeping it
// local here avoids implying parity with the adapter-backed domain types.
interface MockSponsorSummary {
  name: string;
  totalFunded: number;
  activeBounties: number;
  budgetRemaining: number;
  repos: string[];
}

export const mockSponsorSummary: MockSponsorSummary = {
  name: "Stellar Development Foundation",
  totalFunded: 42500,
  activeBounties: 9,
  budgetRemaining: 15800,
  repos: ["stellar-wallet-kit", "core-indexer", "soroban-escrow-sdk"],
};

export const platformStats = {
  totalPaidOut: 184230,
  bountiesCompleted: 612,
  activeContributors: 341,
  avgPayoutTimeMinutes: 4,
};

export const trustedOrgs = [
  "stellar-labs",
  "mergefi",
  "openzeppelin",
  "soroban-foundation",
  "obsrvr",
  "lightsail-network",
];

export interface LeaderboardEntry {
  handle: string;
  earnings: number;
  mergedPRs: number;
  topLanguage: string;
}

export const topContributors: LeaderboardEntry[] = [
  { handle: "priyaeth", earnings: 8420, mergedPRs: 61, topLanguage: "Rust" },
  { handle: "0xkoda", earnings: 3210, mergedPRs: 27, topLanguage: "Rust" },
  { handle: "devrel_ana", earnings: 2890, mergedPRs: 24, topLanguage: "TypeScript" },
  { handle: "qa_marcus", earnings: 2140, mergedPRs: 19, topLanguage: "Go" },
  { handle: "linh_dev", earnings: 1780, mergedPRs: 15, topLanguage: "TypeScript" },
];

export interface ActivityEvent {
  id: string;
  handle: string;
  action: string;
  target: string;
  amount?: number;
  asset?: "USDC" | "XLM";
  /**
   * ISO timestamp of when the event happened. ActivityList derives its
   * "Nm/h/d ago" text from this at render time via Date.now() — a static
   * minutesAgo literal would never advance, contradicting the "Live on the
   * platform" framing this feed is rendered under (#201).
   */
  occurredAt: string;
}

// minutesAgo(n) anchors each mock event n minutes before whenever this
// module is evaluated, so the feed's relative-time text keeps advancing
// (within a given server render) instead of being frozen at deploy time.
function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

export const recentActivity: ActivityEvent[] = [
  {
    id: "a1",
    handle: "devrel_ana",
    action: "was paid",
    target: "core-indexer#288",
    amount: 40,
    asset: "USDC",
    occurredAt: minutesAgo(6),
  },
  {
    id: "a2",
    handle: "0xkoda",
    action: "claimed",
    target: "soroban-escrow-sdk#17",
    occurredAt: minutesAgo(22),
  },
  {
    id: "a3",
    handle: "linh_dev",
    action: "opened a pull request for",
    target: "stellar-wallet-kit#475",
    occurredAt: minutesAgo(48),
  },
  {
    id: "a4",
    handle: "Stellar Development Foundation",
    action: "funded",
    target: "v2.0: Multi-asset escrow",
    amount: 2500,
    asset: "USDC",
    occurredAt: minutesAgo(71),
  },
  {
    id: "a4b",
    handle: "Stellar Community Fund",
    action: "funded",
    target: "v1.4: Indexer performance pass",
    amount: 15000,
    asset: "XLM",
    occurredAt: minutesAgo(95),
  },
  {
    id: "a5",
    handle: "priyaeth",
    action: "was paid",
    target: "core-indexer#301",
    amount: 480,
    asset: "USDC",
    occurredAt: minutesAgo(130),
  },
  {
    id: "a6",
    handle: "qa_marcus",
    action: "joined as a",
    target: "contributor",
    occurredAt: minutesAgo(210),
  },
];


// Weekly earnings/spend series (8 weeks) for dashboard charts.
export const contributorEarningsHistory = [420, 560, 310, 780, 640, 890, 720, 1050];
export const sponsorSpendHistory = [1800, 2400, 2100, 3200, 2800, 3600, 3100, 4200];

export const contributorSparkline = [12, 18, 14, 22, 19, 27, 24, 31];
export const bountiesCompletedSparkline = [40, 44, 42, 51, 55, 58, 60, 64];
export const escrowLockedSparkline = [8, 12, 10, 15, 13, 18, 16, 14];
export const budgetSparkline = [30, 28, 32, 27, 24, 26, 22, 20];

export interface RepoSpend {
  repo: string;
  amount: number;
}

export const sponsorSpendByRepo: RepoSpend[] = [
  { repo: "stellar-wallet-kit", amount: 6200 },
  { repo: "core-indexer", amount: 4800 },
  { repo: "soroban-escrow-sdk", amount: 3100 },
  { repo: "docs-site", amount: 900 },
];

export interface Faq {
  question: string;
  answer: string;
}

export const faqs: Faq[] = [
  {
    question: "How does MergeFi decide when to release payment?",
    answer:
      "MergeFi listens for GitHub webhooks. When a pull request that references a funded issue is merged, the backend verifies the event and calls the escrow contract's release function automatically. There's no manual approval step once a PR is merged.",
  },
  {
    question: "What happens if an issue never gets resolved?",
    answer:
      "Sponsors can refund an unresolved bounty at any time before it's claimed, or after its deadline passes. The escrow contract returns the full amount to the sponsor's wallet.",
  },
  {
    question: "Can a bounty be split between multiple contributors?",
    answer:
      "Yes. Maintainers can define a team split by percentage (for example 40% frontend, 40% backend, 20% testing), and the contract distributes the payout accordingly the moment the work is merged.",
  },
  {
    question: "Which assets can I fund a bounty with?",
    answer:
      "MergeFi currently supports USDC and XLM. Funds are held in a Soroban smart contract on Stellar until release conditions are met.",
  },
  {
    question: "Do I need a Stellar wallet to participate?",
    answer:
      "Contributors need a Stellar wallet (Freighter is supported today) to receive payouts. Sponsors need one to fund escrow. Browsing bounties and building your GitHub reputation doesn't require a wallet.",
  },
];
